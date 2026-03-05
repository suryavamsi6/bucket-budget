import db from '../db/knex.js';
import fs from 'fs';
import path from 'path';

/**
 * ML-powered transaction categorization service.
 * Uses a Naive Bayes classifier trained on user's transaction history.
 * Features: payee tokens (TF-IDF weighted), amount bucket, day-of-week, day-of-month.
 */

function normalizePayee(payee) {
    if (!payee) return '';
    return payee.toLowerCase().trim()
        .replace(/[0-9#*]+/g, '')
        .replace(/[^a-z\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenize(text) {
    return normalizePayee(text).split(' ').filter(t => t.length > 1);
}

function getAmountBucket(amount) {
    const abs = Math.abs(amount || 0);
    if (abs <= 10) return 'amt_0_10';
    if (abs <= 25) return 'amt_10_25';
    if (abs <= 50) return 'amt_25_50';
    if (abs <= 100) return 'amt_50_100';
    if (abs <= 250) return 'amt_100_250';
    if (abs <= 500) return 'amt_250_500';
    if (abs <= 1000) return 'amt_500_1000';
    return 'amt_1000_plus';
}

function getDayOfWeek(dateStr) {
    if (!dateStr) return 'dow_unknown';
    const d = new Date(dateStr);
    return `dow_${d.getDay()}`;
}

function getDayOfMonthBucket(dateStr) {
    if (!dateStr) return 'dom_unknown';
    const day = parseInt(dateStr.split('-')[2] || '1');
    if (day <= 7) return 'dom_week1';
    if (day <= 14) return 'dom_week2';
    if (day <= 21) return 'dom_week3';
    return 'dom_week4';
}

function extractFeatures(payee, amount, date) {
    const tokens = tokenize(payee);
    const features = [...tokens, getAmountBucket(amount), getDayOfWeek(date), getDayOfMonthBucket(date)];
    return features;
}

/**
 * Naive Bayes classifier
 */
class NaiveBayesClassifier {
    constructor() {
        this.categories = {};      // categoryId -> { count, features: { feature: count } }
        this.totalDocs = 0;
        this.vocabulary = new Set();
    }

    train(features, categoryId) {
        if (!this.categories[categoryId]) {
            this.categories[categoryId] = { count: 0, features: {} };
        }
        this.categories[categoryId].count++;
        this.totalDocs++;

        for (const feature of features) {
            this.vocabulary.add(feature);
            this.categories[categoryId].features[feature] =
                (this.categories[categoryId].features[feature] || 0) + 1;
        }
    }

    predict(features, topN = 3) {
        const scores = {};
        const vocabSize = this.vocabulary.size || 1;

        for (const [catId, catData] of Object.entries(this.categories)) {
            // Log prior: P(category)
            let logProb = Math.log(catData.count / this.totalDocs);

            // Total feature count for this category
            const totalFeatures = Object.values(catData.features).reduce((s, v) => s + v, 0);

            // Log likelihood with Laplace smoothing
            for (const feature of features) {
                const featureCount = catData.features[feature] || 0;
                logProb += Math.log((featureCount + 1) / (totalFeatures + vocabSize));
            }

            scores[catId] = logProb;
        }

        // Convert to probabilities via softmax normalization
        const entries = Object.entries(scores);
        if (entries.length === 0) return [];

        const maxScore = Math.max(...entries.map(e => e[1]));
        const expScores = entries.map(([catId, score]) => [catId, Math.exp(score - maxScore)]);
        const sumExp = expScores.reduce((s, [, e]) => s + e, 0);

        return expScores
            .map(([catId, exp]) => ({ category_id: parseInt(catId), confidence: exp / sumExp }))
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, topN);
    }

    serialize() {
        return JSON.stringify({
            categories: this.categories,
            totalDocs: this.totalDocs,
            vocabulary: [...this.vocabulary]
        });
    }

    static deserialize(json) {
        const data = JSON.parse(json);
        const classifier = new NaiveBayesClassifier();
        classifier.categories = data.categories;
        classifier.totalDocs = data.totalDocs;
        classifier.vocabulary = new Set(data.vocabulary);
        return classifier;
    }
}

// In-memory model cache per user
const modelCache = {};

function getModelPath(userId) {
    const dir = path.join(process.cwd(), 'data', 'models');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${userId}.json`);
}

function loadModel(userId) {
    if (modelCache[userId]) return modelCache[userId];
    const modelPath = getModelPath(userId);
    if (fs.existsSync(modelPath)) {
        try {
            const json = fs.readFileSync(modelPath, 'utf-8');
            const model = NaiveBayesClassifier.deserialize(json);
            modelCache[userId] = model;
            return model;
        } catch {
            return null;
        }
    }
    return null;
}

function saveModel(userId, model) {
    modelCache[userId] = model;
    const modelPath = getModelPath(userId);
    fs.writeFileSync(modelPath, model.serialize(), 'utf-8');
}

/**
 * Train or retrain the model for a user using all their categorized transactions.
 */
export async function trainModel(userId) {
    const transactions = await db('transactions')
        .where({ user_id: userId })
        .whereNotNull('category_id')
        .whereNotNull('payee')
        .where('payee', '!=', '')
        .select('payee', 'amount', 'date', 'category_id');

    if (transactions.length < 5) return null; // Not enough data

    const classifier = new NaiveBayesClassifier();

    for (const txn of transactions) {
        const features = extractFeatures(txn.payee, txn.amount, txn.date);
        classifier.train(features, txn.category_id);
    }

    saveModel(userId, classifier);

    // Also update category_predictions cache from the training data
    // (payee → most common category mapping)
    const payeeCategoryMap = {};
    for (const txn of transactions) {
        const pattern = normalizePayee(txn.payee);
        if (!pattern) continue;
        if (!payeeCategoryMap[pattern]) payeeCategoryMap[pattern] = {};
        payeeCategoryMap[pattern][txn.category_id] =
            (payeeCategoryMap[pattern][txn.category_id] || 0) + 1;
    }

    for (const [pattern, categories] of Object.entries(payeeCategoryMap)) {
        const total = Object.values(categories).reduce((s, v) => s + v, 0);
        for (const [catId, count] of Object.entries(categories)) {
            const confidence = count / total;
            const existing = await db('category_predictions')
                .where({ user_id: userId, payee_pattern: pattern, category_id: parseInt(catId) })
                .first();
            if (existing) {
                await db('category_predictions')
                    .where({ id: existing.id })
                    .update({ confidence, training_count: count, updated_at: new Date().toISOString() });
            } else {
                await db('category_predictions').insert({
                    user_id: userId,
                    payee_pattern: pattern,
                    category_id: parseInt(catId),
                    confidence,
                    training_count: count
                });
            }
        }
    }

    // Auto-create rules for high-confidence mappings (5+ confirmations)
    const highConfPredictions = await db('category_predictions')
        .where({ user_id: userId })
        .where('training_count', '>=', 5)
        .where('confidence', '>=', 0.8);

    for (const pred of highConfPredictions) {
        const existingRule = await db('transaction_rules')
            .where({ user_id: userId, match_field: 'payee', match_value: pred.payee_pattern })
            .first();
        if (!existingRule) {
            await db('transaction_rules').insert({
                user_id: userId,
                priority: 0,
                match_field: 'payee',
                match_type: 'contains',
                match_value: pred.payee_pattern,
                set_category_id: pred.category_id,
                auto_created: true
            });
        }
    }

    return classifier;
}

/**
 * Suggest categories for a given transaction's payee/amount/date.
 * Fast path: check category_predictions cache.
 * Slow path: run through trained Naive Bayes model.
 */
export async function suggestCategory(userId, { payee, amount, date }) {
    const pattern = normalizePayee(payee);

    // Fast path: exact match in predictions cache
    const cached = await db('category_predictions')
        .where({ user_id: userId, payee_pattern: pattern })
        .orderBy('confidence', 'desc')
        .limit(3);

    if (cached.length > 0) {
        const categories = await db('categories')
            .whereIn('id', cached.map(c => c.category_id))
            .select('id', 'name');
        const catMap = {};
        categories.forEach(c => { catMap[c.id] = c.name; });

        return cached.map(c => ({
            category_id: c.category_id,
            category_name: catMap[c.category_id] || 'Unknown',
            confidence: parseFloat(c.confidence),
            source: 'history'
        }));
    }

    // Slow path: ML model
    const model = loadModel(userId);
    if (!model) {
        // Try training on-the-fly if we haven't yet
        const trained = await trainModel(userId);
        if (!trained) return [];
    }

    const currentModel = loadModel(userId);
    if (!currentModel) return [];

    const features = extractFeatures(payee, amount, date);
    const predictions = currentModel.predict(features, 3);

    if (predictions.length === 0) return [];

    // Enrich with category names
    const catIds = predictions.map(p => p.category_id);
    const categories = await db('categories')
        .whereIn('id', catIds)
        .select('id', 'name');
    const catMap = {};
    categories.forEach(c => { catMap[c.id] = c.name; });

    return predictions.map(p => ({
        category_id: p.category_id,
        category_name: catMap[p.category_id] || 'Unknown',
        confidence: parseFloat(p.confidence.toFixed(3)),
        source: 'ml'
    }));
}

/**
 * Record categorization feedback when user overrides or confirms a suggestion.
 */
export async function recordFeedback(userId, { transaction_id, suggested_category_id, chosen_category_id, payee, amount }) {
    await db('categorization_feedback').insert({
        user_id: userId,
        transaction_id,
        suggested_category_id,
        chosen_category_id,
        payee,
        amount
    });

    // Update predictions cache
    const pattern = normalizePayee(payee);
    if (pattern && chosen_category_id) {
        const existing = await db('category_predictions')
            .where({ user_id: userId, payee_pattern: pattern, category_id: chosen_category_id })
            .first();
        if (existing) {
            await db('category_predictions')
                .where({ id: existing.id })
                .update({
                    training_count: existing.training_count + 1,
                    updated_at: new Date().toISOString()
                });
        } else {
            await db('category_predictions').insert({
                user_id: userId,
                payee_pattern: pattern,
                category_id: chosen_category_id,
                confidence: 0.5,
                training_count: 1
            });
        }
    }

    // Check if we should auto-retrain (every 50 feedback entries)
    const feedbackCount = await db('categorization_feedback')
        .where({ user_id: userId })
        .count('* as count')
        .first();

    if (feedbackCount.count % 50 === 0) {
        await trainModel(userId);
    }
}

/**
 * Apply rules engine to a transaction object.
 * Returns the modified transaction fields.
 */
export async function applyRules(userId, { payee, amount, category_id, cleared, memo, tags }) {
    const rules = await db('transaction_rules')
        .where({ user_id: userId })
        .orderBy('priority', 'desc');

    let result = { payee, category_id, cleared, memo, tags };

    for (const rule of rules) {
        let matchTarget = '';
        if (rule.match_field === 'payee') matchTarget = (result.payee || '').toLowerCase();
        else if (rule.match_field === 'amount') matchTarget = String(Math.abs(amount || 0));
        else if (rule.match_field === 'memo') matchTarget = (result.memo || '').toLowerCase();

        const matchVal = (rule.match_value || '').toLowerCase();
        let isMatch = false;

        if (rule.match_type === 'contains' && matchTarget.includes(matchVal)) isMatch = true;
        else if (rule.match_type === 'equals' && matchTarget === matchVal) isMatch = true;
        else if (rule.match_type === 'starts_with' && matchTarget.startsWith(matchVal)) isMatch = true;
        else if (rule.match_type === 'regex') {
            try { isMatch = new RegExp(rule.match_value, 'i').test(matchTarget); } catch { /* invalid regex */ }
        }

        if (rule.match_field === 'amount' || rule.match_field === 'amount_range') {
            const absAmt = Math.abs(amount || 0);
            const amtVal = parseFloat(rule.match_value);
            if (rule.match_type === 'less_than' && absAmt < amtVal) isMatch = true;
            if (rule.match_type === 'greater_than' && absAmt > amtVal) isMatch = true;
            if (rule.match_type === 'equals' && Math.abs(absAmt - amtVal) < 0.01) isMatch = true;
        }

        if (isMatch) {
            if (rule.set_category_id && !result.category_id) result.category_id = rule.set_category_id;
            if (rule.set_payee) result.payee = rule.set_payee;
            if (rule.set_cleared !== null && rule.set_cleared !== undefined) result.cleared = !!rule.set_cleared;
            if (rule.set_memo) result.memo = rule.set_memo;
            if (rule.set_tags) result.tags = rule.set_tags;
        }
    }

    return result;
}

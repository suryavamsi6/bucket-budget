import db from '../db/knex.js';
import authenticate from '../middleware/auth.js';

export default async function ruleRoutes(fastify, options) {
    fastify.addHook('preHandler', authenticate);

    // Get all transaction rules for the logged-in user
    fastify.get('/', async (request, reply) => {
        const userId = request.user.id;
        const rules = await db('transaction_rules')
            .where({ user_id: userId })
            .orderBy('priority', 'asc')
            .orderBy('created_at', 'desc');
        return rules;
    });

    // Create a new rule (expanded fields: memo, amount_min/max, set_memo, set_tags)
    fastify.post('/', async (request, reply) => {
        const userId = request.user.id;
        const {
            match_field, match_type, match_value,
            set_category_id, set_payee, set_cleared, set_memo, set_tags,
            priority, auto_created
        } = request.body;

        const [id] = await db('transaction_rules').insert({
            user_id: userId,
            match_field: match_field || 'payee',
            match_type: match_type || 'contains',
            match_value,
            set_category_id: set_category_id || null,
            set_payee: set_payee || null,
            set_cleared: set_cleared !== undefined ? set_cleared : null,
            set_memo: set_memo || null,
            set_tags: set_tags || null,
            priority: priority || 0,
            auto_created: auto_created ? 1 : 0
        });

        const rule = await db('transaction_rules').where({ id, user_id: userId }).first();
        reply.code(201);
        return rule;
    });

    // Update a rule
    fastify.put('/:id', async (request, reply) => {
        const { id } = request.params;
        const userId = request.user.id;
        const updates = request.body;

        const existing = await db('transaction_rules').where({ id, user_id: userId }).first();
        if (!existing) {
            return reply.code(404).send({ error: 'Rule not found' });
        }

        const safeUpdates = {
            match_field: updates.match_field,
            match_type: updates.match_type,
            match_value: updates.match_value,
            set_category_id: updates.set_category_id,
            set_payee: updates.set_payee,
            set_cleared: updates.set_cleared,
            set_memo: updates.set_memo,
            set_tags: updates.set_tags,
            priority: updates.priority,
            auto_created: updates.auto_created !== undefined ? (updates.auto_created ? 1 : 0) : undefined
        };

        Object.keys(safeUpdates).forEach(key => safeUpdates[key] === undefined && delete safeUpdates[key]);

        await db('transaction_rules')
            .where({ id, user_id: userId })
            .update(safeUpdates);

        return db('transaction_rules').where({ id }).first();
    });

    // Delete a rule
    fastify.delete('/:id', async (request, reply) => {
        const { id } = request.params;
        const userId = request.user.id;

        const deleted = await db('transaction_rules')
            .where({ id, user_id: userId })
            .delete();

        if (!deleted) {
            return reply.code(404).send({ error: 'Rule not found' });
        }

        return { success: true };
    });

    // Apply rules to existing transactions (batch)
    fastify.post('/apply', async (request, reply) => {
        const userId = request.user.id;
        const { transaction_ids, dry_run } = request.body || {};

        const rules = await db('transaction_rules')
            .where({ user_id: userId })
            .orderBy('priority', 'asc');

        let query = db('transactions').where('user_id', userId);
        if (transaction_ids && transaction_ids.length > 0) {
            query = query.whereIn('id', transaction_ids);
        }
        const transactions = await query;

        const changes = [];

        for (const txn of transactions) {
            for (const rule of rules) {
                if (matchesRule(rule, txn)) {
                    const updates = {};
                    if (rule.set_category_id) updates.category_id = rule.set_category_id;
                    if (rule.set_payee) updates.payee = rule.set_payee;
                    if (rule.set_memo) updates.memo = rule.set_memo;
                    if (rule.set_cleared !== null && rule.set_cleared !== undefined) updates.cleared = rule.set_cleared;

                    if (Object.keys(updates).length > 0) {
                        changes.push({ transaction_id: txn.id, updates, rule_id: rule.id });
                        if (!dry_run) {
                            await db('transactions').where({ id: txn.id, user_id: userId }).update(updates);
                        }
                    }
                    break; // First matching rule wins
                }
            }
        }

        return { applied: changes.length, changes: dry_run ? changes : undefined };
    });
}

// Rule matching logic supporting expanded match types and fields
function matchesRule(rule, transaction) {
    const field = rule.match_field || 'payee';
    let value = '';

    if (field === 'payee') value = transaction.payee || '';
    else if (field === 'memo') value = transaction.memo || '';
    else if (field === 'amount') {
        // For amount, match_value can be "100" (exact), "50-200" (range), or ">100"
        const amount = Math.abs(parseFloat(transaction.amount || 0));
        const mv = rule.match_value || '';
        if (mv.includes('-')) {
            const [min, max] = mv.split('-').map(Number);
            return amount >= min && amount <= max;
        } else if (mv.startsWith('>')) {
            return amount > parseFloat(mv.substring(1));
        } else if (mv.startsWith('<')) {
            return amount < parseFloat(mv.substring(1));
        } else {
            return Math.abs(amount - parseFloat(mv)) < 0.01;
        }
    }

    const matchValue = rule.match_value || '';
    const matchType = rule.match_type || 'contains';
    const lowerValue = value.toLowerCase();
    const lowerMatch = matchValue.toLowerCase();

    switch (matchType) {
        case 'contains': return lowerValue.includes(lowerMatch);
        case 'equals': return lowerValue === lowerMatch;
        case 'starts_with': return lowerValue.startsWith(lowerMatch);
        case 'ends_with': return lowerValue.endsWith(lowerMatch);
        case 'regex':
            try { return new RegExp(matchValue, 'i').test(value); }
            catch { return false; }
        default: return lowerValue.includes(lowerMatch);
    }
}

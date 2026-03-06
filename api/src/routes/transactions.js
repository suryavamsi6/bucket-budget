import db from '../db/knex.js';
import { parse } from 'csv-parse/sync';
import authenticate from '../middleware/auth.js';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { applyRules, suggestCategory, recordFeedback, trainModel } from '../services/categorization.js';

export default async function transactionRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    // List transactions with optional filters + running balance
    fastify.get('/', async (request) => {
        const { account_id, category_id, from, to, limit = 50, offset = 0 } = request.query;
        const userId = request.user.id;

        let query = db('transactions')
            .select(
                'transactions.*',
                'accounts.name as account_name',
                'categories.name as category_name',
                'category_groups.name as group_name'
            )
            .leftJoin('accounts', 'transactions.account_id', 'accounts.id')
            .leftJoin('categories', 'transactions.category_id', 'categories.id')
            .leftJoin('category_groups', 'categories.group_id', 'category_groups.id')
            .where('transactions.user_id', userId)
            .orderBy('transactions.date', 'desc')
            .orderBy('transactions.id', 'desc');

        if (account_id) query = query.where('transactions.account_id', account_id);
        if (category_id) query = query.where('transactions.category_id', category_id);
        if (from) query = query.where('transactions.date', '>=', from);
        if (to) query = query.where('transactions.date', '<=', to);

        const total = await query.clone().count('* as count').first();
        const transactions = await query.limit(limit).offset(offset);

        // Attach attachments metadata
        if (transactions.length > 0) {
            const txIds = transactions.map(t => t.id);
            const attachments = await db('attachments')
                .whereIn('transaction_id', txIds)
                .select('id', 'transaction_id', 'file_name', 'mime_type', 'size_bytes');

            // Attach splits for split transactions
            const splitTxIds = transactions.filter(t => t.is_split).map(t => t.id);
            let splitsMap = {};
            if (splitTxIds.length > 0) {
                const splits = await db('transaction_splits')
                    .select('transaction_splits.*', 'categories.name as category_name')
                    .leftJoin('categories', 'transaction_splits.category_id', 'categories.id')
                    .whereIn('transaction_id', splitTxIds)
                    .orderBy('sort_order');
                splits.forEach(s => {
                    if (!splitsMap[s.transaction_id]) splitsMap[s.transaction_id] = [];
                    splitsMap[s.transaction_id].push(s);
                });
            }

            transactions.forEach(t => {
                t.attachments = attachments.filter(a => a.transaction_id === t.id);
                if (t.is_split) t.splits = splitsMap[t.id] || [];
            });
        }

        // Compute running balances when filtering by a single account
        if (account_id && transactions.length > 0) {
            // Get the total balance of all transactions BEFORE the current page
            const allBefore = await db('transactions')
                .where({ account_id, user_id: userId })
                .sum('amount as total')
                .first();
            let runningBalance = parseFloat(allBefore?.total || 0);

            // Transactions are in DESC order; compute forward from the account total
            // We need to walk from newest to oldest and subtract
            const offsetTransactions = await db('transactions')
                .where({ account_id, user_id: userId })
                .orderBy('date', 'desc')
                .orderBy('id', 'desc')
                .limit(offset)
                .select('amount');

            // Subtract the amounts of transactions newer than our page
            for (const ot of offsetTransactions) {
                runningBalance -= parseFloat(ot.amount);
            }

            // Now assign running balances going down
            for (const txn of transactions) {
                txn.running_balance = parseFloat(runningBalance.toFixed(2));
                runningBalance -= parseFloat(txn.amount);
            }
        }

        return { data: transactions, total: total.count };
    });

    // Get single transaction with splits
    fastify.get('/:id', async (request, reply) => {
        const txn = await db('transactions')
            .where({ id: request.params.id, user_id: request.user.id })
            .first();
        if (!txn) return reply.code(404).send({ error: 'Transaction not found' });

        if (txn.is_split) {
            txn.splits = await db('transaction_splits')
                .select('transaction_splits.*', 'categories.name as category_name')
                .leftJoin('categories', 'transaction_splits.category_id', 'categories.id')
                .where({ transaction_id: txn.id })
                .orderBy('sort_order');
        }

        return txn;
    });

    // Create transaction (with splits support + auto-rules + transfer naming)
    fastify.post('/', async (request, reply) => {
        let { account_id, category_id, date, payee, memo, amount, transfer_account_id, cleared = false, splits } = request.body;
        const userId = request.user.id;

        if (!account_id || !date || amount === undefined) {
            return reply.code(400).send({ error: 'account_id, date, and amount are required' });
        }

        // Verify account belongs to user
        const account = await db('accounts').where({ id: account_id, user_id: userId }).first();
        if (!account) return reply.code(403).send({ error: 'Invalid account_id' });

        if (category_id) {
            const category = await db('categories').where({ id: category_id, user_id: userId }).first();
            if (!category) return reply.code(403).send({ error: 'Invalid category_id' });
        }

        if (transfer_account_id) {
            const transferAccount = await db('accounts').where({ id: transfer_account_id, user_id: userId }).first();
            if (!transferAccount) return reply.code(403).send({ error: 'Invalid transfer_account_id' });
        }

        // Apply rules engine on manual creation (only if user hasn't explicitly set fields)
        if (!transfer_account_id) {
            const ruleResult = await applyRules(userId, { payee, amount, category_id, cleared, memo });
            if (!category_id && ruleResult.category_id) category_id = ruleResult.category_id;
            if (ruleResult.payee && ruleResult.payee !== payee) payee = ruleResult.payee;
            if (ruleResult.memo && !memo) memo = ruleResult.memo;
        }

        const isSplit = splits && Array.isArray(splits) && splits.length > 0;
        if (isSplit) {
            const splitTotal = splits.reduce((sum, split) => sum + parseFloat(split.amount || 0), 0);
            if (Math.abs(splitTotal - parseFloat(amount)) > 0.01) {
                return reply.code(400).send({ error: 'Split amounts must equal the transaction amount' });
            }

            for (const split of splits) {
                if (!split.category_id) continue;
                const splitCategory = await db('categories').where({ id: split.category_id, user_id: userId }).first();
                if (!splitCategory) return reply.code(403).send({ error: 'Invalid split category_id' });
            }
        }

        const id = await db.transaction(async (trx) => {
            const [newId] = await trx('transactions').insert({
                user_id: userId, account_id,
                category_id: isSplit ? null : category_id,
                date, payee, memo, amount,
                transfer_account_id, cleared,
                is_split: isSplit
            });

            if (isSplit) {
                await trx('transaction_splits').insert(
                    splits.map((s, i) => ({
                        transaction_id: newId,
                        category_id: s.category_id || null,
                        amount: s.amount,
                        memo: s.memo || null,
                        payee: s.payee || null,
                        sort_order: s.sort_order ?? i
                    }))
                );
            }

            await updateAccountBalance(account_id, userId, trx);

            if (transfer_account_id) {
                const transferAccount = await trx('accounts').where({ id: transfer_account_id, user_id: userId }).first();
                await trx('transactions').insert({
                    user_id: userId,
                    account_id: transfer_account_id,
                    date,
                    payee: `Transfer: ${account.name}`,
                    memo,
                    amount: -amount,
                    transfer_account_id: account_id,
                    cleared: true
                });
                await trx('transactions').where({ id: newId, user_id: userId }).update({
                    payee: payee || `Transfer: ${transferAccount.name}`
                });
                await updateAccountBalance(transfer_account_id, userId, trx);
            }

            return newId;
        });

        const txn = await db('transactions').where({ id, user_id: userId }).first();
        if (txn.is_split) {
            txn.splits = await db('transaction_splits').where({ transaction_id: id }).orderBy('sort_order');
        }
        return reply.code(201).send(txn);
    });

    // Update transaction (with splits support)
    fastify.put('/:id', async (request, reply) => {
        const userId = request.user.id;
        const existing = await db('transactions')
            .where({ id: request.params.id, user_id: userId })
            .first();
        if (!existing) return reply.code(404).send({ error: 'Transaction not found' });

        const { account_id, category_id, date, payee, memo, amount, cleared, reconciled, splits } = request.body;
        const updates = {};
        if (account_id !== undefined) updates.account_id = account_id;
        if (category_id !== undefined) updates.category_id = category_id;
        if (date !== undefined) updates.date = date;
        if (payee !== undefined) updates.payee = payee;
        if (memo !== undefined) updates.memo = memo;
        if (amount !== undefined) updates.amount = amount;
        if (cleared !== undefined) updates.cleared = cleared;
        if (reconciled !== undefined) updates.reconciled = reconciled;

        if (account_id !== undefined && account_id !== existing.account_id) {
            const account = await db('accounts').where({ id: account_id, user_id: userId }).first();
            if (!account) return reply.code(403).send({ error: 'Invalid account_id' });
        }

        if (category_id !== undefined && category_id !== null) {
            const category = await db('categories').where({ id: category_id, user_id: userId }).first();
            if (!category) return reply.code(403).send({ error: 'Invalid category_id' });
        }

        // Handle splits update
        if (splits !== undefined) {
            if (Array.isArray(splits) && splits.length > 0) {
                const nextAmount = parseFloat(amount ?? existing.amount);
                const splitTotal = splits.reduce((sum, split) => sum + parseFloat(split.amount || 0), 0);
                if (Math.abs(splitTotal - nextAmount) > 0.01) {
                    return reply.code(400).send({ error: 'Split amounts must equal the transaction amount' });
                }

                for (const split of splits) {
                    if (!split.category_id) continue;
                    const splitCategory = await db('categories').where({ id: split.category_id, user_id: userId }).first();
                    if (!splitCategory) return reply.code(403).send({ error: 'Invalid split category_id' });
                }

                updates.is_split = true;
                updates.category_id = null;
            } else {
                // Splits removed
                updates.is_split = false;
            }
        }

        await db.transaction(async (trx) => {
            if (splits !== undefined) {
                await trx('transaction_splits').where({ transaction_id: request.params.id }).del();

                if (Array.isArray(splits) && splits.length > 0) {
                    await trx('transaction_splits').insert(
                        splits.map((s, i) => ({
                            transaction_id: parseInt(request.params.id, 10),
                            category_id: s.category_id || null,
                            amount: s.amount,
                            memo: s.memo || null,
                            payee: s.payee || null,
                            sort_order: s.sort_order ?? i
                        }))
                    );
                }
            }

            await trx('transactions').where({ id: request.params.id, user_id: userId }).update(updates);

            await updateAccountBalance(existing.account_id, userId, trx);
            if (updates.account_id && updates.account_id !== existing.account_id) {
                await updateAccountBalance(updates.account_id, userId, trx);
            }
        });

        const txn = await db('transactions').where({ id: request.params.id, user_id: userId }).first();
        if (txn.is_split) {
            txn.splits = await db('transaction_splits')
                .select('transaction_splits.*', 'categories.name as category_name')
                .leftJoin('categories', 'transaction_splits.category_id', 'categories.id')
                .where({ transaction_id: txn.id })
                .orderBy('sort_order');
        }
        return txn;
    });

    // Delete transaction
    fastify.delete('/:id', async (request, reply) => {
        const userId = request.user.id;
        const txn = await db('transactions')
            .where({ id: request.params.id, user_id: userId })
            .first();
        if (!txn) return reply.code(404).send({ error: 'Transaction not found' });

        await db.transaction(async (trx) => {
            if (txn.transfer_account_id) {
                const mirrorTxn = await trx('transactions')
                    .where({
                        user_id: userId,
                        account_id: txn.transfer_account_id,
                        transfer_account_id: txn.account_id,
                        date: txn.date
                    })
                    .andWhere('amount', -parseFloat(txn.amount))
                    .first();

                if (mirrorTxn) {
                    await trx('transactions').where({ id: mirrorTxn.id, user_id: userId }).del();
                    await updateAccountBalance(mirrorTxn.account_id, userId, trx);
                }
            }

            await trx('transactions').where({ id: request.params.id, user_id: userId }).del();
            await updateAccountBalance(txn.account_id, userId, trx);
        });
        return { success: true };
    });

    // Suggest category for a transaction (ML-powered)
    fastify.get('/suggest-category', async (request) => {
        const { payee, amount, date } = request.query;
        const userId = request.user.id;
        const suggestions = await suggestCategory(userId, {
            payee: payee || '',
            amount: parseFloat(amount || 0),
            date: date || new Date().toISOString().split('T')[0]
        });
        return suggestions;
    });

    // Record categorization feedback
    fastify.post('/categorization-feedback', async (request) => {
        const userId = request.user.id;
        const { transaction_id, suggested_category_id, chosen_category_id, payee, amount } = request.body;
        await recordFeedback(userId, { transaction_id, suggested_category_id, chosen_category_id, payee, amount });
        return { success: true };
    });

    // Manually trigger ML model retraining
    fastify.post('/retrain', async (request) => {
        const userId = request.user.id;
        await trainModel(userId);
        return { success: true, message: 'Model retrained successfully' };
    });

    // Detect potential duplicate transactions
    fastify.get('/duplicates', async (request) => {
        const userId = request.user.id;
        // Find transactions with same amount, same date (±2 days), similar payee
        const transactions = await db('transactions')
            .select('transactions.*', 'accounts.name as account_name', 'categories.name as category_name')
            .leftJoin('accounts', 'transactions.account_id', 'accounts.id')
            .leftJoin('categories', 'transactions.category_id', 'categories.id')
            .where('transactions.user_id', userId)
            .orderBy('transactions.date', 'desc')
            .limit(500);

        const groups = [];
        const used = new Set();

        for (let i = 0; i < transactions.length; i++) {
            if (used.has(transactions[i].id)) continue;
            const matches = [];
            for (let j = i + 1; j < transactions.length; j++) {
                if (used.has(transactions[j].id)) continue;
                const a = transactions[i], b = transactions[j];

                // Same amount
                if (Math.abs(parseFloat(a.amount) - parseFloat(b.amount)) > 0.01) continue;

                // Date within 2 days
                const dayDiff = Math.abs(new Date(a.date) - new Date(b.date)) / (1000 * 60 * 60 * 24);
                if (dayDiff > 2) continue;

                // Similar payee (case-insensitive)
                const payeeA = (a.payee || '').toLowerCase();
                const payeeB = (b.payee || '').toLowerCase();
                if (payeeA && payeeB && !payeeA.includes(payeeB) && !payeeB.includes(payeeA)) continue;

                matches.push(b);
                used.add(b.id);
            }

            if (matches.length > 0) {
                used.add(transactions[i].id);
                groups.push({
                    transactions: [transactions[i], ...matches]
                });
            }
        }

        return groups;
    });

    // Merge duplicate transactions
    fastify.post('/match', async (request, reply) => {
        const userId = request.user.id;
        const { keep_id, remove_ids } = request.body;

        if (!keep_id || !remove_ids || !Array.isArray(remove_ids)) {
            return reply.code(400).send({ error: 'keep_id and remove_ids are required' });
        }

        // Verify ownership
        const keepTxn = await db('transactions').where({ id: keep_id, user_id: userId }).first();
        if (!keepTxn) return reply.code(404).send({ error: 'Transaction to keep not found' });

        for (const removeId of remove_ids) {
            const removeTxn = await db('transactions').where({ id: removeId, user_id: userId }).first();
            if (!removeTxn) continue;

            // Merge memos if different
            if (removeTxn.memo && removeTxn.memo !== keepTxn.memo) {
                const combinedMemo = [keepTxn.memo, removeTxn.memo].filter(Boolean).join(' | ');
                await db('transactions').where({ id: keep_id }).update({ memo: combinedMemo });
            }

            // Move attachments to kept transaction
            await db('attachments').where({ transaction_id: removeId }).update({ transaction_id: keep_id });

            // Delete the duplicate
            await db('transactions').where({ id: removeId, user_id: userId }).del();
            await updateAccountBalance(removeTxn.account_id, userId);
        }

        const result = await db('transactions').where({ id: keep_id, user_id: userId }).first();
        return result;
    });

    // Get transfer pairs
    fastify.get('/transfers', async (request) => {
        const userId = request.user.id;
        const transfers = await db('transactions')
            .select('transactions.*', 'accounts.name as account_name',
                'ta.name as transfer_account_name')
            .leftJoin('accounts', 'transactions.account_id', 'accounts.id')
            .leftJoin('accounts as ta', 'transactions.transfer_account_id', 'ta.id')
            .where('transactions.user_id', userId)
            .whereNotNull('transactions.transfer_account_id')
            .orderBy('transactions.date', 'desc')
            .limit(100);

        return transfers;
    });

    fastify.post('/import', async (request, reply) => {
        const data = await request.file();
        const userId = request.user.id;
        if (!data) return reply.code(400).send({ error: 'No file uploaded' });

        const buffer = await data.toBuffer();
        const csvContent = buffer.toString('utf-8');
        const records = parse(csvContent, { columns: true, skip_empty_lines: true });

        // Fetch all active rules for this user
        const rules = await db('transaction_rules')
            .where({ user_id: userId })
            .orderBy('priority', 'desc');

        const defaultAccount = await db('accounts').where('user_id', userId).first();
        if (!defaultAccount) return reply.code(400).send({ error: 'Create an account first' });

        let imported = 0;
        for (const row of records) {
            const keys = Object.keys(row);
            const dateKey = keys.find(k => k.toLowerCase().includes('date')) || keys[0];
            const amountKey = keys.find(k => k.toLowerCase().includes('amount')) || keys.find(k => !isNaN(parseFloat(row[k])));
            const payeeKey = keys.find(k => k.toLowerCase().includes('payee') || k.toLowerCase().includes('description')) || keys[1];
            const memoKey = keys.find(k => k.toLowerCase().includes('memo') || k.toLowerCase().includes('note'));

            if (!dateKey || !amountKey) continue;

            let amountStr = row[amountKey].replace(/[^0-9.-]+/g, "");
            let amount = parseFloat(amountStr);
            if (isNaN(amount)) continue;

            const dateStr = row[dateKey];
            const d = new Date(dateStr);
            const date = isNaN(d) ? new Date().toISOString().split('T')[0] : d.toISOString().split('T')[0];

            let finalPayee = row[payeeKey] ? row[payeeKey].substring(0, 255) : 'Imported';
            let finalMemo = memoKey ? (row[memoKey] || '').substring(0, 500) : '';
            let finalCategoryId = null;
            let finalCleared = true;

            // Apply Rules Engine
            for (const rule of rules) {
                let matchTarget = '';
                if (rule.match_field === 'payee') matchTarget = finalPayee.toLowerCase();
                if (rule.match_field === 'amount') matchTarget = amount.toString();
                if (rule.match_field === 'memo') matchTarget = finalMemo.toLowerCase();

                const matchVal = (rule.match_value || '').toLowerCase();
                let isMatch = false;

                if (rule.match_type === 'contains' && matchTarget.includes(matchVal)) isMatch = true;
                if (rule.match_type === 'equals' && matchTarget === matchVal) isMatch = true;
                if (rule.match_type === 'starts_with' && matchTarget.startsWith(matchVal)) isMatch = true;
                if (rule.match_type === 'regex') {
                    try { isMatch = new RegExp(rule.match_value, 'i').test(matchTarget); } catch { /* skip */ }
                }

                if (rule.match_field === 'amount') {
                    const amtTarget = Math.abs(amount);
                    const amtVal = parseFloat(rule.match_value);
                    if (rule.match_type === 'less_than' && amtTarget < amtVal) isMatch = true;
                    if (rule.match_type === 'greater_than' && amtTarget > amtVal) isMatch = true;
                }

                if (isMatch) {
                    if (rule.set_category_id) finalCategoryId = rule.set_category_id;
                    if (rule.set_payee) finalPayee = rule.set_payee;
                    if (rule.set_cleared !== null && rule.set_cleared !== undefined) finalCleared = !!rule.set_cleared;
                    if (rule.set_memo) finalMemo = rule.set_memo;
                }
            }

            // If no rule matched, try ML suggestion
            if (!finalCategoryId) {
                try {
                    const suggestions = await suggestCategory(userId, { payee: finalPayee, amount, date });
                    if (suggestions.length > 0 && suggestions[0].confidence >= 0.7) {
                        finalCategoryId = suggestions[0].category_id;
                    }
                } catch { /* ML not yet trained, skip */ }
            }

            await db('transactions').insert({
                user_id: userId,
                account_id: defaultAccount.id,
                date,
                payee: finalPayee,
                amount,
                memo: finalMemo,
                category_id: finalCategoryId,
                cleared: finalCleared
            });
            imported++;
        }

        // Update account balance after batch import
        await updateAccountBalance(defaultAccount.id, userId);

        return { message: `Successfully imported ${imported} transactions.`, count: imported };
    });

    // Upload Attachment to Transaction
    fastify.post('/:id/attachments', async (request, reply) => {
        const tx = await db('transactions')
            .join('accounts', 'transactions.account_id', 'accounts.id')
            .where({ 'transactions.id': request.params.id, 'accounts.user_id': request.user.id })
            .first();

        if (!tx) return reply.code(404).send({ error: 'Transaction not found or unauthorized' });

        const parts = request.parts();
        const uploadedFiles = [];

        const uploadDir = path.join(process.cwd(), 'data', 'uploads', request.user.id.toString());
        await fs.mkdir(uploadDir, { recursive: true });

        for await (const part of parts) {
            if (part.type === 'file') {
                // Security: Sanitize filename to prevent Path Traversal
                const safeFilename = path.basename(part.filename);
                const uniqueFilename = `${randomUUID()}-${safeFilename}`;
                const filePath = path.join(uploadDir, uniqueFilename);
                const relativePath = path.join(request.user.id.toString(), uniqueFilename);

                const buffer = await part.toBuffer();
                await fs.writeFile(filePath, buffer);

                const [id] = await db('attachments').insert({
                    user_id: request.user.id,
                    transaction_id: tx.id,
                    file_name: safeFilename,
                    file_path: relativePath,
                    mime_type: part.mimetype,
                    size_bytes: buffer.length
                });

                const attachment = await db('attachments').where({ id }).first();
                uploadedFiles.push(attachment);
            }
        }

        return reply.code(201).send(uploadedFiles);
    });

    // Download/View Attachment
    fastify.get('/attachments/:attachmentId', async (request, reply) => {
        const attachment = await db('attachments')
            .where({ id: request.params.attachmentId, user_id: request.user.id })
            .first();

        if (!attachment) return reply.code(404).send({ error: 'Attachment not found' });

        const absolutePath = path.join(process.cwd(), 'data', 'uploads', attachment.file_path);
        try {
            await fs.access(absolutePath);
            reply.header('Content-Type', attachment.mime_type);
            reply.header('Content-Disposition', `inline; filename="${attachment.file_name}"`);
            return reply.send(createReadStream(absolutePath));
        } catch {
            return reply.code(404).send({ error: 'File missing from disk' });
        }
    });

    // Delete Attachment
    fastify.delete('/attachments/:attachmentId', async (request, reply) => {
        const attachment = await db('attachments')
            .where({ id: request.params.attachmentId, user_id: request.user.id })
            .first();

        if (!attachment) return reply.code(404).send({ error: 'Attachment not found' });

        await db('attachments').where({ id: attachment.id }).del();

        const absolutePath = path.join(process.cwd(), 'data', 'uploads', attachment.file_path);
        try {
            await fs.unlink(absolutePath);
        } catch (e) {
            request.log.warn(`Failed to delete file from disk: ${absolutePath}`);
        }

        return { success: true };
    });
}

async function updateAccountBalance(accountId, userId, executor = db) {
    const result = await executor('transactions')
        .where({ account_id: accountId, user_id: userId })
        .sum('amount as total')
        .first();
    await executor('accounts')
        .where({ id: accountId, user_id: userId })
        .update({ balance: result?.total || 0, updated_at: new Date().toISOString() });
}

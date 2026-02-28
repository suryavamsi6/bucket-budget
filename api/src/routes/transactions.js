import db from '../db/knex.js';
import { parse } from 'csv-parse/sync';
import authenticate from '../middleware/auth.js';

export default async function transactionRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    // List transactions with optional filters
    fastify.get('/', async (request) => {
        const { account_id, category_id, from, to, limit = 50, offset = 0 } = request.query;
        const userId = request.user.id;

        let query = db('transactions')
            .select(
                'transactions.*',
                'accounts.name as account_name',
                'categories.name as category_name'
            )
            .leftJoin('accounts', 'transactions.account_id', 'accounts.id')
            .leftJoin('categories', 'transactions.category_id', 'categories.id')
            .where('transactions.user_id', userId)
            .orderBy('transactions.date', 'desc')
            .orderBy('transactions.id', 'desc');

        if (account_id) query = query.where('transactions.account_id', account_id);
        if (category_id) query = query.where('transactions.category_id', category_id);
        if (from) query = query.where('transactions.date', '>=', from);
        if (to) query = query.where('transactions.date', '<=', to);

        const total = await query.clone().count('* as count').first();
        const transactions = await query.limit(limit).offset(offset);

        return { data: transactions, total: total.count };
    });

    // Get single transaction
    fastify.get('/:id', async (request, reply) => {
        const txn = await db('transactions')
            .where({ id: request.params.id, user_id: request.user.id })
            .first();
        if (!txn) return reply.code(404).send({ error: 'Transaction not found' });
        return txn;
    });

    // Create transaction
    fastify.post('/', async (request, reply) => {
        const { account_id, category_id, date, payee, memo, amount, transfer_account_id, cleared = false } = request.body;
        const userId = request.user.id;

        if (!account_id || !date || amount === undefined) {
            return reply.code(400).send({ error: 'account_id, date, and amount are required' });
        }

        // Verify account belongs to user
        const account = await db('accounts').where({ id: account_id, user_id: userId }).first();
        if (!account) return reply.code(403).send({ error: 'Invalid account_id' });

        if (transfer_account_id) {
            const transferAccount = await db('accounts').where({ id: transfer_account_id, user_id: userId }).first();
            if (!transferAccount) return reply.code(403).send({ error: 'Invalid transfer_account_id' });
        }

        const [id] = await db('transactions').insert({
            user_id: userId, account_id, category_id, date, payee, memo, amount,
            transfer_account_id, cleared
        });

        // Update account balance
        await updateAccountBalance(account_id, userId);
        if (transfer_account_id) {
            // Create matching transfer transaction
            await db('transactions').insert({
                user_id: userId,
                account_id: transfer_account_id,
                date, payee: 'Transfer',
                memo, amount: -amount,
                transfer_account_id: account_id,
                cleared
            });
            await updateAccountBalance(transfer_account_id, userId);
        }

        const txn = await db('transactions').where({ id, user_id: userId }).first();
        return reply.code(201).send(txn);
    });

    // Update transaction
    fastify.put('/:id', async (request, reply) => {
        const userId = request.user.id;
        const existing = await db('transactions')
            .where({ id: request.params.id, user_id: userId })
            .first();
        if (!existing) return reply.code(404).send({ error: 'Transaction not found' });

        const { account_id, category_id, date, payee, memo, amount, cleared, reconciled } = request.body;
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

        await db('transactions').where({ id: request.params.id, user_id: userId }).update(updates);

        // Recalculate balances
        await updateAccountBalance(existing.account_id, userId);
        if (updates.account_id && updates.account_id !== existing.account_id) {
            await updateAccountBalance(updates.account_id, userId);
        }

        const txn = await db('transactions').where({ id: request.params.id, user_id: userId }).first();
        return txn;
    });

    // Delete transaction
    fastify.delete('/:id', async (request, reply) => {
        const userId = request.user.id;
        const txn = await db('transactions')
            .where({ id: request.params.id, user_id: userId })
            .first();
        if (!txn) return reply.code(404).send({ error: 'Transaction not found' });

        await db('transactions').where({ id: request.params.id, user_id: userId }).del();
        await updateAccountBalance(txn.account_id, userId);
        return { success: true };
    });

    // CSV Import
    fastify.post('/import', async (request, reply) => {
        const data = await request.file();
        const userId = request.user.id;
        if (!data) return reply.code(400).send({ error: 'No file uploaded' });

        const buffer = await data.toBuffer();
        const csvContent = buffer.toString('utf-8');

        const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        const { account_id } = request.query;
        if (!account_id) return reply.code(400).send({ error: 'account_id query param required' });

        const account = await db('accounts').where({ id: account_id, user_id: userId }).first();
        if (!account) return reply.code(403).send({ error: 'Invalid account_id' });

        let imported = 0;
        for (const row of records) {
            const date = row.Date || row.date;
            const payee = row.Payee || row.payee || row.Description || row.description || '';
            const memo = row.Memo || row.memo || row.Notes || row.notes || '';
            let amount = parseFloat(row.Amount || row.amount || 0);

            // Handle separate inflow/outflow columns
            if (row.Inflow || row.inflow) amount = parseFloat(row.Inflow || row.inflow);
            if (row.Outflow || row.outflow) amount = -Math.abs(parseFloat(row.Outflow || row.outflow));

            if (date && !isNaN(amount)) {
                await db('transactions').insert({
                    user_id: userId,
                    account_id: parseInt(account_id),
                    date,
                    payee,
                    memo,
                    amount
                });
                imported++;
            }
        }

        await updateAccountBalance(parseInt(account_id), userId);
        return { imported, total: records.length };
    });
}

async function updateAccountBalance(accountId, userId) {
    const result = await db('transactions')
        .where({ account_id: accountId, user_id: userId })
        .sum('amount as total')
        .first();
    await db('accounts')
        .where({ id: accountId, user_id: userId })
        .update({ balance: result?.total || 0, updated_at: new Date().toISOString() });
}

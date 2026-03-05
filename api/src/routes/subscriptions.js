import db from '../db/knex.js';
import authenticate from '../middleware/auth.js';
import { processRecurringTransactions } from '../services/recurring.js';

export default async function subscriptionRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    // Get all recurring transactions
    fastify.get('/', async (request) => {
        const userId = request.user.id;
        const recurring = await db('recurring_transactions')
            .select(
                'recurring_transactions.*',
                'accounts.name as account_name',
                'categories.name as category_name'
            )
            .leftJoin('accounts', 'recurring_transactions.account_id', 'accounts.id')
            .leftJoin('categories', 'recurring_transactions.category_id', 'categories.id')
            .where('recurring_transactions.user_id', userId)
            .orderBy('recurring_transactions.next_date', 'asc');

        return recurring;
    });

    // Process recurring transactions
    fastify.post('/process', async (request, reply) => {
        const processed = await processRecurringTransactions();
        return { success: true, processed };
    });

    // Create a new recurring transaction
    fastify.post('/', async (request, reply) => {
        const userId = request.user.id;
        const data = request.body;

        if (!data.account_id || !data.type || !data.amount || !data.frequency || !data.next_date) {
            return reply.code(400).send({ error: 'Missing required fields' });
        }

        const [id] = await db('recurring_transactions').insert({
            user_id: userId,
            account_id: data.account_id,
            category_id: data.category_id || null,
            transfer_account_id: data.transfer_account_id || null,
            type: data.type,
            amount: data.amount,
            payee: data.payee || '',
            memo: data.memo || '',
            frequency: data.frequency,
            next_date: data.next_date,
            is_subscription: data.is_subscription || false,
            subscription_url: data.subscription_url || '',
            status: data.status || 'active'
        });

        const newRecord = await db('recurring_transactions').where({ id, user_id: userId }).first();
        return reply.code(201).send(newRecord);
    });

    // Update
    fastify.put('/:id', async (request, reply) => {
        const userId = request.user.id;
        const { id } = request.params;
        const updates = request.body;

        const existing = await db('recurring_transactions').where({ id, user_id: userId }).first();
        if (!existing) return reply.code(404).send({ error: 'Not found' });

        const allowedUpdates = ['account_id', 'category_id', 'transfer_account_id', 'type', 'amount', 'payee', 'memo', 'frequency', 'next_date', 'is_subscription', 'subscription_url', 'status'];
        const updateData = {};
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) updateData[key] = updates[key];
        }
        updateData.updated_at = new Date().toISOString();

        await db('recurring_transactions').where({ id, user_id: userId }).update(updateData);

        const updatedRecord = await db('recurring_transactions').where({ id, user_id: userId }).first();
        return updatedRecord;
    });

    // Delete
    fastify.delete('/:id', async (request, reply) => {
        const userId = request.user.id;
        const { id } = request.params;

        const existing = await db('recurring_transactions').where({ id, user_id: userId }).first();
        if (!existing) return reply.code(404).send({ error: 'Not found' });

        await db('recurring_transactions').where({ id, user_id: userId }).del();
        return { success: true };
    });

    // Get upcoming projected transactions for the next N days (calendar / bill-pay view)
    fastify.get('/upcoming', async (request) => {
        const userId = request.user.id;
        const days = parseInt(request.query.days || '30');
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + days);
        const endStr = endDate.toISOString().split('T')[0];
        const todayStr = today.toISOString().split('T')[0];

        const recurring = await db('recurring_transactions')
            .select(
                'recurring_transactions.*',
                'accounts.name as account_name',
                'categories.name as category_name'
            )
            .leftJoin('accounts', 'recurring_transactions.account_id', 'accounts.id')
            .leftJoin('categories', 'recurring_transactions.category_id', 'categories.id')
            .where('recurring_transactions.user_id', userId)
            .where('recurring_transactions.status', 'active')
            .where('recurring_transactions.next_date', '<=', endStr);

        const upcoming = [];

        for (const rec of recurring) {
            let nextDate = new Date(rec.next_date);
            // Generate all occurrences within the window
            let safety = 0;
            while (nextDate <= endDate && safety < 100) {
                if (nextDate >= today) {
                    upcoming.push({
                        recurring_id: rec.id,
                        date: nextDate.toISOString().split('T')[0],
                        payee: rec.payee,
                        amount: rec.amount,
                        type: rec.type,
                        frequency: rec.frequency,
                        account_name: rec.account_name,
                        category_name: rec.category_name,
                        is_subscription: rec.is_subscription,
                        is_projected: true
                    });
                }
                // Advance to next occurrence
                nextDate = advanceDate(nextDate, rec.frequency);
                safety++;
            }
        }

        // Sort by date
        upcoming.sort((a, b) => a.date.localeCompare(b.date));

        // Also add already-recorded transactions for the period
        const recorded = await db('transactions')
            .select('transactions.*', 'accounts.name as account_name', 'categories.name as category_name')
            .leftJoin('accounts', 'transactions.account_id', 'accounts.id')
            .leftJoin('categories', 'transactions.category_id', 'categories.id')
            .where('transactions.user_id', userId)
            .where('transactions.date', '>=', todayStr)
            .where('transactions.date', '<=', endStr)
            .orderBy('transactions.date', 'asc');

        return {
            upcoming,
            recorded: recorded.map(t => ({ ...t, is_projected: false })),
            total_projected: upcoming.reduce((s, u) => s + parseFloat(u.amount || 0), 0)
        };
    });
}

function advanceDate(date, frequency) {
    const d = new Date(date);
    switch (frequency) {
        case 'daily': d.setDate(d.getDate() + 1); break;
        case 'weekly': d.setDate(d.getDate() + 7); break;
        case 'biweekly': d.setDate(d.getDate() + 14); break;
        case 'monthly': d.setMonth(d.getMonth() + 1); break;
        case 'quarterly': d.setMonth(d.getMonth() + 3); break;
        case 'yearly': d.setFullYear(d.getFullYear() + 1); break;
        default: d.setMonth(d.getMonth() + 1); break;
    }
    return d;
}

import db from '../db/knex.js';
import authenticate from '../middleware/auth.js';

export default async function accountRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    // List all accounts
    fastify.get('/', async (request) => {
        const accounts = await db('accounts')
            .where('user_id', request.user.id)
            .orderBy('sort_order');
        return accounts;
    });

    // Get single account
    fastify.get('/:id', async (request, reply) => {
        const account = await db('accounts')
            .where({ id: request.params.id, user_id: request.user.id })
            .first();
        if (!account) return reply.code(404).send({ error: 'Account not found' });
        return account;
    });

    // Create account
    fastify.post('/', async (request, reply) => {
        const { name, type, balance = 0, on_budget = true } = request.body;
        if (!name || !type) return reply.code(400).send({ error: 'Name and type are required' });

        const maxSort = await db('accounts')
            .where('user_id', request.user.id)
            .max('sort_order as max').first();
        const sort_order = (maxSort?.max || 0) + 1;

        const [id] = await db('accounts').insert({
            user_id: request.user.id,
            name, type, balance, on_budget, sort_order
        });

        // If starting balance != 0, create an initial balance transaction
        if (balance !== 0) {
            await db('transactions').insert({
                user_id: request.user.id,
                account_id: id,
                date: new Date().toISOString().split('T')[0],
                payee: 'Starting Balance',
                amount: balance,
                cleared: true,
                memo: 'Initial account balance'
            });
        }

        const account = await db('accounts').where({ id, user_id: request.user.id }).first();
        return reply.code(201).send(account);
    });

    // Update account
    fastify.put('/:id', async (request, reply) => {
        const { name, type, on_budget, closed, sort_order } = request.body;
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (type !== undefined) updates.type = type;
        if (on_budget !== undefined) updates.on_budget = on_budget;
        if (closed !== undefined) updates.closed = closed;
        if (sort_order !== undefined) updates.sort_order = sort_order;
        updates.updated_at = new Date().toISOString();

        await db('accounts')
            .where({ id: request.params.id, user_id: request.user.id })
            .update(updates);

        const account = await db('accounts')
            .where({ id: request.params.id, user_id: request.user.id })
            .first();

        if (!account) return reply.code(404).send({ error: 'Account not found' });
        return account;
    });

    // Delete account
    fastify.delete('/:id', async (request, reply) => {
        const deleted = await db('accounts')
            .where({ id: request.params.id, user_id: request.user.id })
            .del();
        if (!deleted) return reply.code(404).send({ error: 'Account not found' });
        return { success: true };
    });

    // Recalculate account balance from transactions
    fastify.post('/:id/recalculate', async (request, reply) => {
        const { id } = request.params;

        // Verify account ownership
        const account = await db('accounts').where({ id, user_id: request.user.id }).first();
        if (!account) return reply.code(404).send({ error: 'Account not found' });

        const result = await db('transactions')
            .where({ account_id: id, user_id: request.user.id })
            .sum('amount as total')
            .first();

        const balance = result?.total || 0;
        await db('accounts').where({ id, user_id: request.user.id }).update({ balance, updated_at: new Date().toISOString() });
        return { id: parseInt(id), balance };
    });
}

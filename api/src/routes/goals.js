import db from '../db/knex.js';
import authenticate from '../middleware/auth.js';

export default async function goalRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    // Get all goals for user
    fastify.get('/', async (request) => {
        const userId = request.user.id;
        return db('goals').where('user_id', userId).orderBy('created_at', 'desc');
    });

    // Create goal
    fastify.post('/', async (request, reply) => {
        const userId = request.user.id;
        const data = request.body;
        if (!data.name || !data.target_amount) {
            return reply.code(400).send({ error: 'Name and target amount are required' });
        }
        const [id] = await db('goals').insert({
            user_id: userId,
            name: data.name,
            icon: data.icon || '🎯',
            target_amount: parseFloat(data.target_amount),
            saved_amount: parseFloat(data.saved_amount) || 0,
            target_date: data.target_date || null,
            color: data.color || '#6366f1',
            category_id: data.category_id || null,
            status: 'active'
        });
        const goal = await db('goals').where({ id, user_id: userId }).first();
        return reply.code(201).send(goal);
    });

    // Update goal
    fastify.put('/:id', async (request, reply) => {
        const userId = request.user.id;
        const { id } = request.params;
        const updates = request.body;
        const existing = await db('goals').where({ id, user_id: userId }).first();
        if (!existing) return reply.code(404).send({ error: 'Not found' });

        const allowed = ['name', 'icon', 'target_amount', 'saved_amount', 'target_date', 'color', 'category_id', 'status'];
        const updateData = {};
        for (const key of allowed) {
            if (updates[key] !== undefined) updateData[key] = updates[key];
        }
        updateData.updated_at = new Date().toISOString();

        // Auto-complete if saved >= target
        if (updateData.saved_amount && parseFloat(updateData.saved_amount) >= parseFloat(existing.target_amount)) {
            updateData.status = 'completed';
        }

        await db('goals').where({ id, user_id: userId }).update(updateData);
        return db('goals').where({ id, user_id: userId }).first();
    });

    // Add money to goal
    fastify.post('/:id/contribute', async (request, reply) => {
        const userId = request.user.id;
        const { id } = request.params;
        const { amount } = request.body;
        const goal = await db('goals').where({ id, user_id: userId }).first();
        if (!goal) return reply.code(404).send({ error: 'Not found' });

        const newAmount = parseFloat(goal.saved_amount) + parseFloat(amount);
        const updates = { saved_amount: newAmount, updated_at: new Date().toISOString() };
        if (newAmount >= parseFloat(goal.target_amount)) updates.status = 'completed';

        await db('goals').where({ id, user_id: userId }).update(updates);
        return db('goals').where({ id, user_id: userId }).first();
    });

    // Delete goal
    fastify.delete('/:id', async (request, reply) => {
        const userId = request.user.id;
        const { id } = request.params;
        const existing = await db('goals').where({ id, user_id: userId }).first();
        if (!existing) return reply.code(404).send({ error: 'Not found' });
        await db('goals').where({ id, user_id: userId }).del();
        return { success: true };
    });
}

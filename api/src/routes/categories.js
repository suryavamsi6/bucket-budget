import db from '../db/knex.js';
import authenticate from '../middleware/auth.js';

export default async function categoryRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    // List all category groups with their categories
    fastify.get('/category-groups', async (request) => {
        const groups = await db('category_groups')
            .where('user_id', request.user.id)
            .orderBy('sort_order');

        const categories = await db('categories')
            .where('user_id', request.user.id)
            .orderBy('sort_order');

        return groups.map(g => ({
            ...g,
            categories: categories.filter(c => c.group_id === g.id)
        }));
    });

    // Create category group
    fastify.post('/category-groups', async (request, reply) => {
        const { name } = request.body;
        if (!name) return reply.code(400).send({ error: 'Name is required' });

        const maxSort = await db('category_groups')
            .where('user_id', request.user.id)
            .max('sort_order as max').first();
        const sort_order = (maxSort?.max || 0) + 1;

        const [id] = await db('category_groups').insert({
            user_id: request.user.id,
            name,
            sort_order
        });
        const group = await db('category_groups').where({ id, user_id: request.user.id }).first();
        return reply.code(201).send(group);
    });

    // Update category group
    fastify.put('/category-groups/:id', async (request, reply) => {
        const { name, sort_order, hidden } = request.body;
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (sort_order !== undefined) updates.sort_order = sort_order;
        if (hidden !== undefined) updates.hidden = hidden;

        await db('category_groups')
            .where({ id: request.params.id, user_id: request.user.id })
            .update(updates);

        const group = await db('category_groups')
            .where({ id: request.params.id, user_id: request.user.id })
            .first();

        if (!group) return reply.code(404).send({ error: 'Group not found' });
        return group;
    });

    // Delete category group
    fastify.delete('/category-groups/:id', async (request, reply) => {
        const deleted = await db('category_groups')
            .where({ id: request.params.id, user_id: request.user.id })
            .del();
        if (!deleted) return reply.code(404).send({ error: 'Group not found' });
        return { success: true };
    });

    // Create category
    fastify.post('/categories', async (request, reply) => {
        const { group_id, name, goal_type, goal_amount, goal_target_date } = request.body;
        if (!group_id || !name) return reply.code(400).send({ error: 'group_id and name are required' });

        // Verify group belongs to user
        const group = await db('category_groups').where({ id: group_id, user_id: request.user.id }).first();
        if (!group) return reply.code(403).send({ error: 'Invalid group_id' });

        const maxSort = await db('categories')
            .where('group_id', group_id)
            .max('sort_order as max').first();
        const sort_order = (maxSort?.max || 0) + 1;

        const [id] = await db('categories').insert({
            user_id: request.user.id,
            group_id, name, sort_order, goal_type, goal_amount, goal_target_date
        });
        const category = await db('categories').where({ id, user_id: request.user.id }).first();
        return reply.code(201).send(category);
    });

    // Update category
    fastify.put('/categories/:id', async (request, reply) => {
        const { name, group_id, sort_order, hidden, goal_type, goal_amount, goal_target_date } = request.body;
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (sort_order !== undefined) updates.sort_order = sort_order;
        if (hidden !== undefined) updates.hidden = hidden;
        if (goal_type !== undefined) updates.goal_type = goal_type;
        if (goal_amount !== undefined) updates.goal_amount = goal_amount;
        if (goal_target_date !== undefined) updates.goal_target_date = goal_target_date;

        if (group_id !== undefined) {
            // Verify group belongs to user
            const group = await db('category_groups').where({ id: group_id, user_id: request.user.id }).first();
            if (!group) return reply.code(403).send({ error: 'Invalid group_id' });
            updates.group_id = group_id;
        }

        await db('categories')
            .where({ id: request.params.id, user_id: request.user.id })
            .update(updates);

        const category = await db('categories')
            .where({ id: request.params.id, user_id: request.user.id })
            .first();

        if (!category) return reply.code(404).send({ error: 'Category not found' });
        return category;
    });

    // Delete category
    fastify.delete('/categories/:id', async (request, reply) => {
        const deleted = await db('categories')
            .where({ id: request.params.id, user_id: request.user.id })
            .del();
        if (!deleted) return reply.code(404).send({ error: 'Category not found' });
        return { success: true };
    });
}

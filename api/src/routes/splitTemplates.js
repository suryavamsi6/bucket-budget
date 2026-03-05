import db from '../db/knex.js';
import authenticate from '../middleware/auth.js';

export default async function splitTemplateRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    // List all split templates
    fastify.get('/', async (request) => {
        const userId = request.user.id;
        const templates = await db('split_templates').where({ user_id: userId }).orderBy('created_at', 'desc');

        for (const tmpl of templates) {
            tmpl.lines = await db('split_template_lines')
                .select('split_template_lines.*', 'categories.name as category_name')
                .leftJoin('categories', 'split_template_lines.category_id', 'categories.id')
                .where({ template_id: tmpl.id })
                .orderBy('sort_order');
        }

        return templates;
    });

    // Create split template
    fastify.post('/', async (request, reply) => {
        const userId = request.user.id;
        const { name, total_amount, lines = [] } = request.body;

        if (!name) return reply.code(400).send({ error: 'Name is required' });

        const [id] = await db('split_templates').insert({
            user_id: userId,
            name,
            total_amount: total_amount || null
        });

        if (lines.length > 0) {
            await db('split_template_lines').insert(
                lines.map((line, i) => ({
                    template_id: id,
                    category_id: line.category_id || null,
                    amount: line.amount || null,
                    percentage: line.percentage || null,
                    payee: line.payee || null,
                    memo: line.memo || null,
                    sort_order: line.sort_order ?? i
                }))
            );
        }

        const template = await db('split_templates').where({ id }).first();
        template.lines = await db('split_template_lines').where({ template_id: id }).orderBy('sort_order');
        return reply.code(201).send(template);
    });

    // Update split template
    fastify.put('/:id', async (request, reply) => {
        const userId = request.user.id;
        const { id } = request.params;
        const { name, total_amount, lines } = request.body;

        const existing = await db('split_templates').where({ id, user_id: userId }).first();
        if (!existing) return reply.code(404).send({ error: 'Template not found' });

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (total_amount !== undefined) updates.total_amount = total_amount;

        await db('split_templates').where({ id, user_id: userId }).update(updates);

        if (lines !== undefined) {
            await db('split_template_lines').where({ template_id: id }).del();
            if (lines.length > 0) {
                await db('split_template_lines').insert(
                    lines.map((line, i) => ({
                        template_id: parseInt(id),
                        category_id: line.category_id || null,
                        amount: line.amount || null,
                        percentage: line.percentage || null,
                        payee: line.payee || null,
                        memo: line.memo || null,
                        sort_order: line.sort_order ?? i
                    }))
                );
            }
        }

        const template = await db('split_templates').where({ id }).first();
        template.lines = await db('split_template_lines').where({ template_id: id }).orderBy('sort_order');
        return template;
    });

    // Delete split template
    fastify.delete('/:id', async (request, reply) => {
        const userId = request.user.id;
        const { id } = request.params;

        const deleted = await db('split_templates').where({ id, user_id: userId }).del();
        if (!deleted) return reply.code(404).send({ error: 'Template not found' });
        return { success: true };
    });
}

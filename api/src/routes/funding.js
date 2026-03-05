import db from '../db/knex.js';
import authenticate from '../middleware/auth.js';

export default async function fundingRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    // List all funding templates
    fastify.get('/', async (request) => {
        const userId = request.user.id;
        const templates = await db('funding_templates').where({ user_id: userId }).orderBy('created_at', 'desc');

        for (const tmpl of templates) {
            tmpl.lines = await db('funding_template_lines')
                .select('funding_template_lines.*', 'categories.name as category_name')
                .leftJoin('categories', 'funding_template_lines.category_id', 'categories.id')
                .where({ template_id: tmpl.id })
                .orderBy('sort_order');
        }

        return templates;
    });

    // Create funding template
    fastify.post('/', async (request, reply) => {
        const userId = request.user.id;
        const { name, trigger_type = 'manual', trigger_recurring_id, schedule_frequency, schedule_next_date, lines = [] } = request.body;

        if (!name) return reply.code(400).send({ error: 'Name is required' });

        const [id] = await db('funding_templates').insert({
            user_id: userId,
            name,
            trigger_type,
            trigger_recurring_id: trigger_recurring_id || null,
            schedule_frequency: schedule_frequency || null,
            schedule_next_date: schedule_next_date || null
        });

        if (lines.length > 0) {
            await db('funding_template_lines').insert(
                lines.map((line, i) => ({
                    template_id: id,
                    category_id: line.category_id,
                    amount: line.amount || 0,
                    type: line.type || 'fixed',
                    sort_order: line.sort_order ?? i
                }))
            );
        }

        const template = await db('funding_templates').where({ id }).first();
        template.lines = await db('funding_template_lines').where({ template_id: id }).orderBy('sort_order');
        return reply.code(201).send(template);
    });

    // Update funding template
    fastify.put('/:id', async (request, reply) => {
        const userId = request.user.id;
        const { id } = request.params;
        const { name, trigger_type, trigger_recurring_id, schedule_frequency, schedule_next_date, lines } = request.body;

        const existing = await db('funding_templates').where({ id, user_id: userId }).first();
        if (!existing) return reply.code(404).send({ error: 'Template not found' });

        const updates = {};
        if (name !== undefined) updates.name = name;
        if (trigger_type !== undefined) updates.trigger_type = trigger_type;
        if (trigger_recurring_id !== undefined) updates.trigger_recurring_id = trigger_recurring_id || null;
        if (schedule_frequency !== undefined) updates.schedule_frequency = schedule_frequency;
        if (schedule_next_date !== undefined) updates.schedule_next_date = schedule_next_date;
        updates.updated_at = new Date().toISOString();

        await db('funding_templates').where({ id, user_id: userId }).update(updates);

        if (lines !== undefined) {
            await db('funding_template_lines').where({ template_id: id }).del();
            if (lines.length > 0) {
                await db('funding_template_lines').insert(
                    lines.map((line, i) => ({
                        template_id: parseInt(id),
                        category_id: line.category_id,
                        amount: line.amount || 0,
                        type: line.type || 'fixed',
                        sort_order: line.sort_order ?? i
                    }))
                );
            }
        }

        const template = await db('funding_templates').where({ id }).first();
        template.lines = await db('funding_template_lines').where({ template_id: id }).orderBy('sort_order');
        return template;
    });

    // Delete funding template
    fastify.delete('/:id', async (request, reply) => {
        const userId = request.user.id;
        const { id } = request.params;

        const deleted = await db('funding_templates').where({ id, user_id: userId }).del();
        if (!deleted) return reply.code(404).send({ error: 'Template not found' });
        return { success: true };
    });

    // Apply a funding template for a given month
    fastify.post('/:id/apply', async (request, reply) => {
        const userId = request.user.id;
        const { id } = request.params;
        const { month, income_amount } = request.body;

        if (!month) return reply.code(400).send({ error: 'month is required (YYYY-MM)' });

        const template = await db('funding_templates').where({ id, user_id: userId }).first();
        if (!template) return reply.code(404).send({ error: 'Template not found' });

        const lines = await db('funding_template_lines').where({ template_id: id }).orderBy('sort_order');
        if (lines.length === 0) return reply.code(400).send({ error: 'Template has no lines' });

        const totalIncome = parseFloat(income_amount || 0);
        let allocated = 0;
        const assignments = [];

        // First pass: fixed and percentage
        for (const line of lines) {
            if (line.type === 'remainder') continue;

            let assignAmount = 0;
            if (line.type === 'fixed') {
                assignAmount = parseFloat(line.amount);
            } else if (line.type === 'percentage') {
                assignAmount = totalIncome * (parseFloat(line.amount) / 100);
            }

            assignAmount = parseFloat(assignAmount.toFixed(2));
            allocated += assignAmount;
            assignments.push({ category_id: line.category_id, amount: assignAmount });
        }

        // Second pass: remainder
        for (const line of lines) {
            if (line.type !== 'remainder') continue;
            const remaining = Math.max(0, totalIncome - allocated);
            assignments.push({ category_id: line.category_id, amount: parseFloat(remaining.toFixed(2)) });
            allocated += remaining;
        }

        // Apply assignments to budget_allocations
        for (const { category_id, amount } of assignments) {
            if (!category_id) continue;
            const existing = await db('budget_allocations')
                .where({ category_id, month, user_id: userId })
                .first();

            if (existing) {
                await db('budget_allocations')
                    .where({ category_id, month, user_id: userId })
                    .update({ assigned: parseFloat(existing.assigned) + amount });
            } else {
                await db('budget_allocations').insert({
                    user_id: userId,
                    category_id,
                    month,
                    assigned: amount
                });
            }
        }

        return { success: true, assignments, total_allocated: allocated };
    });
}

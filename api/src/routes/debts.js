import db from '../db/knex.js';
import authenticate from '../middleware/auth.js';

export default async function debtRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    // Get all debts for user with payoff calculations
    fastify.get('/', async (request) => {
        const userId = request.user.id;
        const debts = await db('debts').where('user_id', userId).orderBy('interest_rate', 'desc');

        // Calculate payoff info for each debt
        return debts.map(debt => {
            const balance = parseFloat(debt.balance);
            const rate = parseFloat(debt.interest_rate) / 100 / 12; // monthly rate
            const minPayment = parseFloat(debt.minimum_payment);
            const extraPayment = parseFloat(debt.extra_payment) || 0;
            const totalPayment = minPayment + extraPayment;

            let monthsToPayoff = 0;
            let totalInterest = 0;

            if (balance > 0 && totalPayment > 0 && totalPayment > balance * rate) {
                let remaining = balance;
                while (remaining > 0 && monthsToPayoff < 600) { // cap at 50 years
                    const interest = remaining * rate;
                    totalInterest += interest;
                    remaining = remaining + interest - totalPayment;
                    monthsToPayoff++;
                    if (remaining < 0) remaining = 0;
                }
            }

            return {
                ...debt,
                months_to_payoff: monthsToPayoff,
                total_interest: Math.round(totalInterest * 100) / 100,
                payoff_date: monthsToPayoff > 0
                    ? new Date(Date.now() + monthsToPayoff * 30.44 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                    : null
            };
        });
    });

    // Snowball vs Avalanche comparison
    fastify.get('/strategies', async (request) => {
        const userId = request.user.id;
        const debts = await db('debts').where('user_id', userId);
        if (debts.length === 0) return { snowball: [], avalanche: [], summary: {} };

        const totalExtra = debts.reduce((s, d) => s + (parseFloat(d.extra_payment) || 0), 0);

        function simulate(orderedDebts) {
            const remaining = orderedDebts.map(d => ({
                id: d.id, name: d.name, balance: parseFloat(d.balance),
                rate: parseFloat(d.interest_rate) / 100 / 12,
                minPayment: parseFloat(d.minimum_payment)
            }));
            let months = 0, totalInterest = 0, freed = 0;
            const payoffOrder = [];
            while (remaining.some(d => d.balance > 0) && months < 600) {
                months++;
                let extraBudget = totalExtra + freed;
                for (const d of remaining) {
                    if (d.balance <= 0) continue;
                    const interest = d.balance * d.rate;
                    totalInterest += interest;
                    d.balance += interest;
                    const payment = d.minPayment + (remaining.indexOf(d) === remaining.findIndex(x => x.balance > 0) ? extraBudget : 0);
                    d.balance -= payment;
                    if (d.balance <= 0) {
                        freed += d.minPayment;
                        payoffOrder.push({ id: d.id, name: d.name, month: months });
                        d.balance = 0;
                    }
                }
            }
            return { months, totalInterest: Math.round(totalInterest * 100) / 100, payoffOrder };
        }

        const snowball = simulate([...debts].sort((a, b) => parseFloat(a.balance) - parseFloat(b.balance)));
        const avalanche = simulate([...debts].sort((a, b) => parseFloat(b.interest_rate) - parseFloat(a.interest_rate)));

        return {
            snowball: snowball.payoffOrder,
            avalanche: avalanche.payoffOrder,
            summary: {
                snowball_months: snowball.months,
                snowball_interest: snowball.totalInterest,
                avalanche_months: avalanche.months,
                avalanche_interest: avalanche.totalInterest,
                savings: Math.round((snowball.totalInterest - avalanche.totalInterest) * 100) / 100
            }
        };
    });

    // Create debt
    fastify.post('/', async (request, reply) => {
        const userId = request.user.id;
        const data = request.body;
        if (!data.name || data.balance === undefined) {
            return reply.code(400).send({ error: 'Name and balance are required' });
        }
        const [id] = await db('debts').insert({
            user_id: userId,
            name: data.name,
            type: data.type || 'credit_card',
            balance: parseFloat(data.balance),
            interest_rate: parseFloat(data.interest_rate) || 0,
            minimum_payment: parseFloat(data.minimum_payment) || 0,
            extra_payment: parseFloat(data.extra_payment) || 0,
            due_day: data.due_day || '1',
            color: data.color || '#ef4444'
        });
        return reply.code(201).send(await db('debts').where({ id, user_id: userId }).first());
    });

    // Update debt
    fastify.put('/:id', async (request, reply) => {
        const userId = request.user.id;
        const { id } = request.params;
        const updates = request.body;
        const existing = await db('debts').where({ id, user_id: userId }).first();
        if (!existing) return reply.code(404).send({ error: 'Not found' });

        const allowed = ['name', 'type', 'balance', 'interest_rate', 'minimum_payment', 'extra_payment', 'due_day', 'color'];
        const updateData = {};
        for (const key of allowed) {
            if (updates[key] !== undefined) updateData[key] = updates[key];
        }
        updateData.updated_at = new Date().toISOString();
        await db('debts').where({ id, user_id: userId }).update(updateData);
        return db('debts').where({ id, user_id: userId }).first();
    });

    // Delete debt
    fastify.delete('/:id', async (request, reply) => {
        const userId = request.user.id;
        const { id } = request.params;
        const existing = await db('debts').where({ id, user_id: userId }).first();
        if (!existing) return reply.code(404).send({ error: 'Not found' });
        await db('debts').where({ id, user_id: userId }).del();
        return { success: true };
    });
}

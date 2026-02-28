import db from '../db/knex.js';
import authenticate from '../middleware/auth.js';

/**
 * Calculate XIRR (Extended Internal Rate of Return) from a series of cash flows.
 * cashFlows: [{ amount: number, date: Date }]
 * Positive = outflow (buy), Negative = inflow (sell / current value)
 */
function calcXIRR(cashFlows) {
    if (!cashFlows || cashFlows.length < 2) return null;

    const daysInYear = 365.25;

    // Newton's method to find rate
    function xnpv(rate, flows) {
        const d0 = flows[0].date;
        return flows.reduce((sum, cf) => {
            const days = (cf.date - d0) / (1000 * 60 * 60 * 24);
            return sum + cf.amount / Math.pow(1 + rate, days / daysInYear);
        }, 0);
    }

    function xnpvDeriv(rate, flows) {
        const d0 = flows[0].date;
        return flows.reduce((sum, cf) => {
            const days = (cf.date - d0) / (1000 * 60 * 60 * 24);
            const t = days / daysInYear;
            return sum - t * cf.amount / Math.pow(1 + rate, t + 1);
        }, 0);
    }

    let rate = 0.1; // initial guess 10%
    for (let i = 0; i < 100; i++) {
        const npv = xnpv(rate, cashFlows);
        const deriv = xnpvDeriv(rate, cashFlows);
        if (Math.abs(deriv) < 1e-10) break;
        const newRate = rate - npv / deriv;
        if (Math.abs(newRate - rate) < 1e-7) {
            rate = newRate;
            break;
        }
        rate = newRate;
        // Guard against divergence
        if (rate < -0.99) rate = -0.99;
        if (rate > 10) rate = 10;
    }

    // Validate result
    if (isNaN(rate) || !isFinite(rate)) return null;
    return Math.round(rate * 10000) / 100; // percentage, 2 decimals
}

export default async function investmentRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    // Get all investments for user (with XIRR calculated)
    fastify.get('/', async (request) => {
        const userId = request.user.id;
        const investments = await db('investments')
            .where('user_id', userId)
            .orderBy('asset_class', 'asc')
            .orderBy('ticker', 'asc');

        // Fetch all transactions for XIRR calculation
        const allTxns = await db('investment_transactions')
            .where('user_id', userId)
            .orderBy('date', 'asc');

        // Group transactions by investment_id
        const txnsByInvestment = {};
        for (const txn of allTxns) {
            if (!txnsByInvestment[txn.investment_id]) txnsByInvestment[txn.investment_id] = [];
            txnsByInvestment[txn.investment_id].push(txn);
        }

        // Calculate XIRR for each investment
        return investments.map(inv => {
            const txns = txnsByInvestment[inv.id] || [];
            let xirr = null;

            if (txns.length > 0) {
                const currentValue = parseFloat(inv.quantity) * parseFloat(inv.current_price || inv.average_price);
                const cashFlows = txns.map(t => ({
                    amount: (t.type === 'sell' ? -1 : 1) * parseFloat(t.quantity) * parseFloat(t.price),
                    date: new Date(t.date)
                }));
                // Add current value as a negative flow (what you'd get if you sold today)
                if (currentValue > 0) {
                    cashFlows.push({
                        amount: -currentValue,
                        date: new Date()
                    });
                }
                xirr = calcXIRR(cashFlows);
            }

            return {
                ...inv,
                xirr,
                transaction_count: txns.length
            };
        });
    });

    // Create a new investment
    fastify.post('/', async (request, reply) => {
        const userId = request.user.id;
        const data = request.body;

        if (!data.ticker || !data.name) {
            return reply.code(400).send({ error: 'Ticker and Name are required' });
        }

        const [id] = await db('investments').insert({
            user_id: userId,
            ticker: data.ticker.toUpperCase(),
            name: data.name,
            asset_class: data.asset_class || 'Stock',
            quantity: data.quantity || 0,
            average_price: data.average_price || 0,
            current_price: data.current_price || data.average_price || 0,
            sip_enabled: data.sip_enabled ? 1 : 0,
            sip_amount: parseFloat(data.sip_amount) || 0,
            sip_frequency: data.sip_frequency || 'monthly',
            sip_day: parseInt(data.sip_day) || 1
        });

        const newRecord = await db('investments').where({ id, user_id: userId }).first();
        return reply.code(201).send(newRecord);
    });

    // Update investment
    fastify.put('/:id', async (request, reply) => {
        const userId = request.user.id;
        const { id } = request.params;
        const updates = request.body;

        const existing = await db('investments').where({ id, user_id: userId }).first();
        if (!existing) return reply.code(404).send({ error: 'Not found' });

        const allowedUpdates = [
            'ticker', 'name', 'asset_class', 'quantity', 'average_price', 'current_price',
            'sip_enabled', 'sip_amount', 'sip_frequency', 'sip_day'
        ];
        const updateData = {};
        for (const key of allowedUpdates) {
            if (updates[key] !== undefined) {
                if (key === 'ticker') updateData[key] = updates[key].toUpperCase();
                else if (key === 'sip_enabled') updateData[key] = updates[key] ? 1 : 0;
                else if (key === 'sip_amount') updateData[key] = parseFloat(updates[key]) || 0;
                else if (key === 'sip_day') updateData[key] = parseInt(updates[key]) || 1;
                else updateData[key] = updates[key];
            }
        }
        updateData.updated_at = new Date().toISOString();

        await db('investments').where({ id, user_id: userId }).update(updateData);

        const updatedRecord = await db('investments').where({ id, user_id: userId }).first();
        return updatedRecord;
    });

    // Delete investment
    fastify.delete('/:id', async (request, reply) => {
        const userId = request.user.id;
        const { id } = request.params;

        const existing = await db('investments').where({ id, user_id: userId }).first();
        if (!existing) return reply.code(404).send({ error: 'Not found' });

        await db('investments').where({ id, user_id: userId }).del();
        return { success: true };
    });

    // ========= INVESTMENT TRANSACTIONS =========

    // Get transactions for a specific investment
    fastify.get('/:id/transactions', async (request, reply) => {
        const userId = request.user.id;
        const { id } = request.params;

        const investment = await db('investments').where({ id, user_id: userId }).first();
        if (!investment) return reply.code(404).send({ error: 'Investment not found' });

        const txns = await db('investment_transactions')
            .where({ investment_id: id, user_id: userId })
            .orderBy('date', 'desc');

        return txns;
    });

    // Add a transaction (buy/sell/sip) and recalculate quantity + average_price
    fastify.post('/:id/transactions', async (request, reply) => {
        const userId = request.user.id;
        const { id } = request.params;
        const data = request.body;

        const investment = await db('investments').where({ id, user_id: userId }).first();
        if (!investment) return reply.code(404).send({ error: 'Investment not found' });

        if (!data.quantity || !data.price || !data.date) {
            return reply.code(400).send({ error: 'Quantity, price, and date are required' });
        }

        await db('investment_transactions').insert({
            user_id: userId,
            investment_id: parseInt(id),
            type: data.type || 'buy',
            quantity: parseFloat(data.quantity),
            price: parseFloat(data.price),
            date: data.date,
            notes: data.notes || null
        });

        // Recalculate quantity and average_price from all transactions
        const allTxns = await db('investment_transactions')
            .where({ investment_id: id, user_id: userId })
            .orderBy('date', 'asc');

        let totalQty = 0;
        let totalCost = 0;
        for (const t of allTxns) {
            const q = parseFloat(t.quantity);
            const p = parseFloat(t.price);
            if (t.type === 'sell') {
                totalQty -= q;
                totalCost -= q * (totalCost / (totalQty + q)); // reduce cost at average
            } else {
                totalCost += q * p;
                totalQty += q;
            }
        }

        const avgPrice = totalQty > 0 ? totalCost / totalQty : 0;

        await db('investments').where({ id, user_id: userId }).update({
            quantity: Math.max(0, totalQty),
            average_price: Math.max(0, Math.round(avgPrice * 100) / 100),
            updated_at: new Date().toISOString()
        });

        const updated = await db('investments').where({ id, user_id: userId }).first();
        return reply.code(201).send(updated);
    });

    // Delete a transaction and recalculate
    fastify.delete('/:id/transactions/:txnId', async (request, reply) => {
        const userId = request.user.id;
        const { id, txnId } = request.params;

        const txn = await db('investment_transactions')
            .where({ id: txnId, investment_id: id, user_id: userId }).first();
        if (!txn) return reply.code(404).send({ error: 'Transaction not found' });

        await db('investment_transactions')
            .where({ id: txnId, investment_id: id, user_id: userId }).del();

        // Recalculate
        const allTxns = await db('investment_transactions')
            .where({ investment_id: id, user_id: userId })
            .orderBy('date', 'asc');

        let totalQty = 0;
        let totalCost = 0;
        for (const t of allTxns) {
            const q = parseFloat(t.quantity);
            const p = parseFloat(t.price);
            if (t.type === 'sell') {
                totalQty -= q;
                totalCost -= q * (totalCost / (totalQty + q));
            } else {
                totalCost += q * p;
                totalQty += q;
            }
        }

        const avgPrice = totalQty > 0 ? totalCost / totalQty : 0;

        await db('investments').where({ id, user_id: userId }).update({
            quantity: Math.max(0, totalQty),
            average_price: Math.max(0, Math.round(avgPrice * 100) / 100),
            updated_at: new Date().toISOString()
        });

        return { success: true };
    });
}

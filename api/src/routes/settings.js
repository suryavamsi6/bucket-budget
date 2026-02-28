import db from '../db/knex.js';
import authenticate from '../middleware/auth.js';

export default async function settingsRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    // Get all settings
    fastify.get('/', async (request) => {
        const userId = request.user.id;
        const rows = await db('settings').where('user_id', userId);
        const settings = {};
        rows.forEach(r => { settings[r.key] = r.value; });
        return settings;
    });

    // Update a setting
    fastify.put('/:key', async (request) => {
        const { key } = request.params;
        const { value } = request.body;
        const userId = request.user.id;

        const existing = await db('settings').where({ key, user_id: userId }).first();
        if (existing) {
            await db('settings').where({ key, user_id: userId }).update({ value });
        } else {
            await db('settings').insert({ user_id: userId, key, value });
        }
        return { key, value };
    });

    // Batch update settings
    fastify.put('/', async (request) => {
        const updates = request.body;
        const userId = request.user.id;
        for (const [key, value] of Object.entries(updates)) {
            const existing = await db('settings').where({ key, user_id: userId }).first();
            if (existing) {
                await db('settings').where({ key, user_id: userId }).update({ value: String(value) });
            } else {
                await db('settings').insert({ user_id: userId, key, value: String(value) });
            }
        }
        const rows = await db('settings').where('user_id', userId);
        const settings = {};
        rows.forEach(r => { settings[r.key] = r.value; });
        return settings;
    });

    // Get payee suggestions (autocomplete)
    fastify.get('/payees', async (request) => {
        const { q } = request.query;
        const userId = request.user.id;
        let query = db('transactions')
            .distinct('payee')
            .where('user_id', userId)
            .whereNotNull('payee')
            .where('payee', '!=', '')
            .orderBy('payee')
            .limit(20);

        if (q) {
            query = query.where('payee', 'like', `%${q}%`);
        }

        const rows = await query;
        return rows.map(r => r.payee);
    });

    // Age of Money calculation
    fastify.get('/age-of-money', async (request) => {
        const userId = request.user.id;
        // Age of Money = average number of days between when money is received and when it is spent
        // Simplified: days since oldest unspent dollar
        const totalBalance = await db('accounts')
            .where({ user_id: userId, closed: false })
            .sum('balance as total')
            .first();

        const balance = totalBalance?.total || 0;
        if (balance <= 0) return { age: 0 };

        // Find the date where cumulative income from newest to oldest equals current balance
        const incomeTransactions = await db('transactions')
            .where({ user_id: userId })
            .where('amount', '>', 0)
            .whereNull('transfer_account_id')
            .orderBy('date', 'desc');

        let cumulative = 0;
        let oldestDate = null;
        for (const txn of incomeTransactions) {
            cumulative += parseFloat(txn.amount);
            oldestDate = txn.date;
            if (cumulative >= balance) break;
        }

        if (!oldestDate) return { age: 0 };

        const today = new Date();
        const oldest = new Date(oldestDate);
        const diffDays = Math.floor((today - oldest) / (1000 * 60 * 60 * 24));
        return { age: diffDays, oldest_income_date: oldestDate };
    });

    // Export transactions as CSV
    fastify.get('/export/transactions', async (request, reply) => {
        const userId = request.user.id;
        const transactions = await db('transactions')
            .select(
                'transactions.date', 'transactions.payee', 'transactions.memo',
                'transactions.amount', 'transactions.cleared',
                'accounts.name as account', 'categories.name as category'
            )
            .leftJoin('accounts', 'transactions.account_id', 'accounts.id')
            .leftJoin('categories', 'transactions.category_id', 'categories.id')
            .where('transactions.user_id', userId)
            .orderBy('transactions.date', 'desc');

        let csv = 'Date,Account,Payee,Category,Memo,Amount,Cleared\n';
        for (const t of transactions) {
            const row = [
                t.date,
                `"${(t.account || '').replace(/"/g, '""')}"`,
                `"${(t.payee || '').replace(/"/g, '""')}"`,
                `"${(t.category || '').replace(/"/g, '""')}"`,
                `"${(t.memo || '').replace(/"/g, '""')}"`,
                t.amount,
                t.cleared ? 'Yes' : 'No'
            ].join(',');
            csv += row + '\n';
        }

        reply.header('Content-Type', 'text/csv');
        reply.header('Content-Disposition', 'attachment; filename="bucket-budget-export.csv"');
        return csv;
    });

    // Sankey flow data (Income → Groups → Categories)
    fastify.get('/sankey/:month', async (request) => {
        const { month } = request.params;
        const userId = request.user.id;
        const startDate = `${month}-01`;
        const endDate = `${month}-31`;

        // Get income for the month
        const income = await db('transactions')
            .where('user_id', userId)
            .where('amount', '>', 0)
            .whereNull('transfer_account_id')
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .sum('amount as total')
            .first();

        // Get spending by category with group info
        const spending = await db('transactions')
            .select('category_groups.name as group_name', 'categories.name as category_name', db.raw('SUM(ABS(transactions.amount)) as total'))
            .leftJoin('categories', 'transactions.category_id', 'categories.id')
            .leftJoin('category_groups', 'categories.group_id', 'category_groups.id')
            .where('transactions.user_id', userId)
            .where('transactions.amount', '<', 0)
            .whereNull('transactions.transfer_account_id')
            .whereNotNull('transactions.category_id')
            .where('transactions.date', '>=', startDate)
            .where('transactions.date', '<=', endDate)
            .groupBy('transactions.category_id');

        // Build Sankey nodes and links
        const nodes = [];
        const links = [];
        const nodeIndex = {};

        const addNode = (name) => {
            if (!(name in nodeIndex)) {
                nodeIndex[name] = nodes.length;
                nodes.push({ name });
            }
            return nodeIndex[name];
        };

        addNode('Income');

        // Aggregate by group
        const groupTotals = {};
        for (const row of spending) {
            const grp = row.group_name || 'Uncategorized';
            groupTotals[grp] = (groupTotals[grp] || 0) + (row.total || 0);
        }

        // Income → Group links
        for (const [grp, total] of Object.entries(groupTotals)) {
            const grpIdx = addNode(grp);
            links.push({ source: 0, target: grpIdx, value: total });
        }

        // Savings link (income - expenses)
        const totalExpenses = Object.values(groupTotals).reduce((s, v) => s + v, 0);
        const totalIncome = income?.total || 0;
        const saved = totalIncome - totalExpenses;
        if (saved > 0) {
            const savingsIdx = addNode('Savings');
            links.push({ source: 0, target: savingsIdx, value: saved });
        }

        // Group → Category links
        for (const row of spending) {
            const grp = row.group_name || 'Uncategorized';
            const cat = row.category_name || 'Unknown';
            const grpIdx = nodeIndex[grp];
            const catIdx = addNode(cat);
            links.push({ source: grpIdx, target: catIdx, value: row.total || 0 });
        }

        return { nodes, links };
    });

    // Account reconciliation
    fastify.post('/reconcile/:accountId', async (request, reply) => {
        const { accountId } = request.params;
        const { balance: targetBalance } = request.body;
        const userId = request.user.id;

        const account = await db('accounts').where({ id: accountId, user_id: userId }).first();
        if (!account) return reply.code(403).send({ error: 'Invalid accountId' });

        // Mark all cleared transactions as reconciled
        await db('transactions')
            .where({ account_id: accountId, user_id: userId })
            .where('cleared', true)
            .where('reconciled', false)
            .update({ reconciled: true });

        // Calculate current balance from reconciled + cleared transactions
        const result = await db('transactions')
            .where({ account_id: accountId, user_id: userId })
            .sum('amount as total')
            .first();

        const currentBalance = result?.total || 0;
        const adjustment = targetBalance - currentBalance;

        // Create adjustment transaction if needed
        if (Math.abs(adjustment) > 0.005) {
            await db('transactions').insert({
                user_id: userId,
                account_id: parseInt(accountId),
                date: new Date().toISOString().split('T')[0],
                payee: 'Reconciliation Adjustment',
                amount: adjustment,
                cleared: true,
                reconciled: true,
                memo: `Adjustment to match statement balance of ${targetBalance}`
            });
        }

        // Update account balance
        const newResult = await db('transactions')
            .where({ account_id: accountId, user_id: userId })
            .sum('amount as total')
            .first();
        await db('accounts')
            .where({ id: accountId, user_id: userId })
            .update({ balance: newResult?.total || 0, updated_at: new Date().toISOString() });

        return { success: true, adjustment, new_balance: newResult?.total || 0 };
    });

    // Copy budget from last month
    fastify.post('/copy-budget/:month', async (request) => {
        const { month } = request.params;
        const userId = request.user.id;

        // Calculate previous month
        const d = new Date(month + '-01');
        d.setMonth(d.getMonth() - 1);
        const prevMonth = d.toISOString().slice(0, 7);

        const prevAllocations = await db('budget_allocations').where({ month: prevMonth, user_id: userId });

        if (prevAllocations.length === 0) {
            return { copied: 0, message: 'No budget found for previous month' };
        }

        let copied = 0;
        for (const alloc of prevAllocations) {
            const existing = await db('budget_allocations')
                .where({ category_id: alloc.category_id, month, user_id: userId })
                .first();

            if (!existing) {
                await db('budget_allocations').insert({
                    user_id: userId,
                    category_id: alloc.category_id,
                    month,
                    assigned: alloc.assigned
                });
                copied++;
            }
        }

        return { copied, total: prevAllocations.length };
    });

    // Move money between categories
    fastify.post('/move-money', async (request) => {
        const { from_category_id, to_category_id, amount, month } = request.body;
        const userId = request.user.id;

        if (!from_category_id || !to_category_id || !amount || !month) {
            return { error: 'from_category_id, to_category_id, amount, and month are required' };
        }

        // Decrease from source
        const fromAlloc = await db('budget_allocations')
            .where({ category_id: from_category_id, month, user_id: userId })
            .first();

        if (fromAlloc) {
            await db('budget_allocations')
                .where({ category_id: from_category_id, month, user_id: userId })
                .update({ assigned: fromAlloc.assigned - amount });
        } else {
            await db('budget_allocations').insert({
                user_id: userId, category_id: from_category_id, month, assigned: -amount
            });
        }

        // Increase to destination
        const toAlloc = await db('budget_allocations')
            .where({ category_id: to_category_id, month, user_id: userId })
            .first();

        if (toAlloc) {
            await db('budget_allocations')
                .where({ category_id: to_category_id, month, user_id: userId })
                .update({ assigned: toAlloc.assigned + amount });
        } else {
            await db('budget_allocations').insert({
                user_id: userId, category_id: to_category_id, month, assigned: amount
            });
        }

        return { success: true };
    });
}

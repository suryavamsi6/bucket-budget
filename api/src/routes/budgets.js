import db from '../db/knex.js';
import authenticate from '../middleware/auth.js';

export default async function budgetRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    // Get budget for a specific month (includes splits + CC payment tracking)
    fastify.get('/:month', async (request) => {
        const { month } = request.params; // YYYY-MM
        const userId = request.user.id;

        const groups = await db('category_groups').where('user_id', userId).orderBy('sort_order');
        const categories = await db('categories').where('user_id', userId).orderBy('sort_order');
        const allocations = await db('budget_allocations').where({ month, user_id: userId });

        // Calculate activity (sum of transactions) for each category in this month
        const startDate = `${month}-01`;
        const endDate = `${month}-31`;

        // Direct category activity (non-split transactions)
        const directActivity = await db('transactions')
            .select('category_id')
            .sum('amount as total')
            .where('user_id', userId)
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .whereNotNull('category_id')
            .where('is_split', false)
            .groupBy('category_id');

        // Split transaction activity (through transaction_splits)
        const splitActivity = await db('transaction_splits')
            .select('transaction_splits.category_id')
            .sum('transaction_splits.amount as total')
            .join('transactions', 'transaction_splits.transaction_id', 'transactions.id')
            .where('transactions.user_id', userId)
            .where('transactions.date', '>=', startDate)
            .where('transactions.date', '<=', endDate)
            .whereNotNull('transaction_splits.category_id')
            .groupBy('transaction_splits.category_id');

        const activityMap = {};
        directActivity.forEach(a => { activityMap[a.category_id] = (activityMap[a.category_id] || 0) + (a.total || 0); });
        splitActivity.forEach(a => { activityMap[a.category_id] = (activityMap[a.category_id] || 0) + (a.total || 0); });

        const allocationMap = {};
        allocations.forEach(a => { allocationMap[a.category_id] = a.assigned || 0; });

        // CC payment auto-budget: for tracked CC accounts, auto-add on-budget spending to CC payment category
        const ccLinks = await db('cc_payment_categories')
            .select('cc_payment_categories.*', 'accounts.user_id')
            .join('accounts', 'cc_payment_categories.account_id', 'accounts.id')
            .where('accounts.user_id', userId);

        for (const ccLink of ccLinks) {
            // Sum of on-budget spending on this CC in this month
            const ccSpending = await db('transactions')
                .where({ account_id: ccLink.account_id, user_id: userId })
                .where('amount', '<', 0)
                .where('date', '>=', startDate)
                .where('date', '<=', endDate)
                .whereNotNull('category_id')
                .sum('amount as total')
                .first();

            // Add the absolute value of CC spending as "auto-assigned" to the CC payment category
            const autoAssigned = Math.abs(parseFloat(ccSpending?.total || 0));
            if (autoAssigned > 0) {
                activityMap[ccLink.category_id] = (activityMap[ccLink.category_id] || 0);
                // The CC payment category's "available" should reflect what's needed to pay the CC
                // We add automobile to the allocation map as auto-budgeted amount
                allocationMap[ccLink.category_id] = (allocationMap[ccLink.category_id] || 0) + autoAssigned;
            }
        }

        // Calculate available = all prior months' (assigned + activity) + this month's assigned + this month's activity
        const priorAvailable = await calculatePriorAvailable(month, userId);

        const result = groups.map(group => ({
            ...group,
            categories: categories
                .filter(c => c.group_id === group.id)
                .map(cat => {
                    const assigned = allocationMap[cat.id] || 0;
                    const act = activityMap[cat.id] || 0;
                    const prior = priorAvailable[cat.id] || 0;
                    const available = prior + assigned + act;
                    const isCCPayment = ccLinks.some(cc => cc.category_id === cat.id);
                    return {
                        ...cat,
                        assigned,
                        activity: act,
                        available,
                        goal_progress: cat.goal_amount ? Math.min(100, (available / cat.goal_amount) * 100) : null,
                        is_cc_payment: isCCPayment
                    };
                })
        }));

        return result;
    });

    // Get budget summary
    fastify.get('/summary/:month', async (request) => {
        const { month } = request.params;
        const userId = request.user.id;

        // Total income (all inflows across all time up to end of this month)
        const endDate = `${month}-31`;
        const totalIncome = await db('transactions')
            .where('user_id', userId)
            .where('amount', '>', 0)
            .where('date', '<=', endDate)
            .whereNull('transfer_account_id')
            .sum('amount as total')
            .first();

        // Get past carryovers to see what actually carried over physically vs vanished
        // The total money assigned in prior months is "locked in" ONLY IF it rolled over
        // If it vanished (strategy 'none'), it means it goes back to To Be Budgeted

        // Let's compute exact "Available" in all categories up to this month
        const priorCarryovers = await calculatePriorAvailable(month, userId);
        const totalRolledOver = Object.values(priorCarryovers).reduce((sum, val) => sum + (val > 0 ? val : 0), 0);

        // Overspending also affects To Be Budgeted
        const totalDebt = Object.values(priorCarryovers).reduce((sum, val) => sum + (val < 0 ? val : 0), 0);

        // This month's assigned
        const monthAssignedRecord = await db('budget_allocations')
            .where('user_id', userId)
            .where('month', month)
            .sum('assigned as total')
            .first();
        const monthAssigned = monthAssignedRecord?.total || 0;

        // Current month's income / expenses purely for reporting
        const startDate = `${month}-01`;
        const monthIncomeRec = await db('transactions')
            .where('user_id', userId)
            .where('amount', '>', 0)
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .whereNull('transfer_account_id')
            .sum('amount as total')
            .first();

        const monthExpensesRec = await db('transactions')
            .where('user_id', userId)
            .where('amount', '<', 0)
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .whereNull('transfer_account_id')
            .sum('amount as total')
            .first();

        // Calculate exact exact amount that was consumed purely by transactions + exact amount locked in categories
        const totalLifetimeExpenses = await db('transactions')
            .where('user_id', userId)
            .where('amount', '<', 0)
            .where('date', '<', startDate) // only prior months
            .whereNull('transfer_account_id')
            .sum('amount as total')
            .first();

        // toBeBudgeted = Total Income + Total Prior Expenses (negative) - Total Rolled Over (positive) - Total Debt (negative) - This Month's Assigned
        const totalIn = totalIncome?.total || 0;
        const totalOutPrior = totalLifetimeExpenses?.total || 0; // negative

        const toBeBudgeted = totalIn + totalOutPrior - totalRolledOver + totalDebt - monthAssigned;

        return {
            to_be_budgeted: toBeBudgeted,
            total_income: totalIn,
            total_assigned: totalRolledOver + monthAssigned,
            month_income: monthIncomeRec?.total || 0,
            month_expenses: monthExpensesRec?.total || 0,
            month_assigned: monthAssigned
        };
    });

    // Assign money to a category for a month
    fastify.put('/:month/:categoryId', async (request) => {
        const { month, categoryId } = request.params;
        const { assigned } = request.body;
        const userId = request.user.id;

        const existing = await db('budget_allocations')
            .where({ category_id: categoryId, month, user_id: userId })
            .first();

        if (existing) {
            await db('budget_allocations')
                .where({ category_id: categoryId, month, user_id: userId })
                .update({ assigned });
        } else {
            await db('budget_allocations').insert({
                user_id: userId, category_id: categoryId, month, assigned
            });
        }

        return { category_id: parseInt(categoryId), month, assigned };
    });
}

async function calculatePriorAvailable(currentMonth, userId) {
    // 1. Get all categories and their rollover settings
    const categories = await db('categories').where('user_id', userId).select('id', 'rollover_strategy', 'sweep_target_id');
    const catSettings = {};
    categories.forEach(c => {
        catSettings[c.id] = { strategy: c.rollover_strategy || 'none', sweep_target: c.sweep_target_id };
    });

    // 2. We need to calculate month by month from the start of the user's history up to currentMonth
    // Fetch all allocations and transactions before currentMonth
    const allAllocations = await db('budget_allocations')
        .where('user_id', userId)
        .where('month', '<', currentMonth);

    // Direct (non-split) transactions
    const allTransactions = await db('transactions')
        .where('user_id', userId)
        .where('date', '<', `${currentMonth}-01`)
        .where('is_split', false)
        .whereNotNull('category_id');

    // Split transaction activity
    const allSplitActivity = await db('transaction_splits')
        .select('transaction_splits.category_id', 'transaction_splits.amount', 'transactions.date')
        .join('transactions', 'transaction_splits.transaction_id', 'transactions.id')
        .where('transactions.user_id', userId)
        .where('transactions.date', '<', `${currentMonth}-01`)
        .whereNotNull('transaction_splits.category_id');

    // Group by month
    const timeline = {}; // 'YYYY-MM' -> { categoryId -> { assigned, activity } }

    allAllocations.forEach(a => {
        if (!timeline[a.month]) timeline[a.month] = {};
        if (!timeline[a.month][a.category_id]) timeline[a.month][a.category_id] = { assigned: 0, activity: 0 };
        timeline[a.month][a.category_id].assigned += a.assigned;
    });

    allTransactions.forEach(t => {
        const month = t.date.substring(0, 7); // 'YYYY-MM'
        if (!timeline[month]) timeline[month] = {};
        if (!timeline[month][t.category_id]) timeline[month][t.category_id] = { assigned: 0, activity: 0 };
        timeline[month][t.category_id].activity += t.amount;
    });

    allSplitActivity.forEach(s => {
        const month = s.date.substring(0, 7);
        if (!timeline[month]) timeline[month] = {};
        if (!timeline[month][s.category_id]) timeline[month][s.category_id] = { assigned: 0, activity: 0 };
        timeline[month][s.category_id].activity += s.amount;
    });

    const months = Object.keys(timeline).sort();
    let carryovers = {}; // categoryId -> amount carrying into next month

    for (const month of months) {
        const nextCarryovers = {};
        const monthData = timeline[month];

        // First pass: calculate raw ending balance = (brought forward) + assigned + activity
        for (const catId of Object.keys(catSettings)) {
            const rawBalance = (carryovers[catId] || 0) +
                (monthData[catId]?.assigned || 0) +
                (monthData[catId]?.activity || 0);

            const strategy = catSettings[catId].strategy;

            if (rawBalance < 0) {
                // Overspending ALWAYS rolls over as debt (YNAB standard logic)
                nextCarryovers[catId] = rawBalance;
            } else {
                // Positive balances are handled by the strategy
                if (strategy === 'rollover') {
                    nextCarryovers[catId] = rawBalance;
                } else if (strategy === 'sweep' && catSettings[catId].sweep_target) {
                    const targetId = catSettings[catId].sweep_target;
                    nextCarryovers[targetId] = (nextCarryovers[targetId] || 0) + rawBalance;
                } else {
                    // 'none' or 'sweep without target': it vanishes back to To Be Budgeted 
                    // (handled dynamically by total formulas, we just don't carry it forward)
                }
            }
        }
        carryovers = nextCarryovers;
    }

    // Now `carryovers` contains what rolls into `currentMonth`
    return carryovers;
}

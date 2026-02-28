import db from '../db/knex.js';
import authenticate from '../middleware/auth.js';

export default async function budgetRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    // Get budget for a specific month
    fastify.get('/:month', async (request) => {
        const { month } = request.params; // YYYY-MM
        const userId = request.user.id;

        const groups = await db('category_groups').where('user_id', userId).orderBy('sort_order');
        const categories = await db('categories').where('user_id', userId).orderBy('sort_order');
        const allocations = await db('budget_allocations').where({ month, user_id: userId });

        // Calculate activity (sum of transactions) for each category in this month
        const startDate = `${month}-01`;
        const endDate = `${month}-31`;

        const activity = await db('transactions')
            .select('category_id')
            .sum('amount as total')
            .where('user_id', userId)
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .whereNotNull('category_id')
            .groupBy('category_id');

        const activityMap = {};
        activity.forEach(a => { activityMap[a.category_id] = a.total || 0; });

        const allocationMap = {};
        allocations.forEach(a => { allocationMap[a.category_id] = a.assigned || 0; });

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
                    return {
                        ...cat,
                        assigned,
                        activity: act,
                        available,
                        goal_progress: cat.goal_amount ? Math.min(100, (available / cat.goal_amount) * 100) : null
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

        // Total assigned across all months up to this month
        const totalAssigned = await db('budget_allocations')
            .where('user_id', userId)
            .where('month', '<=', month)
            .sum('assigned as total')
            .first();

        const toBeBudgeted = (totalIncome?.total || 0) - (totalAssigned?.total || 0);

        // This month's totals
        const startDate = `${month}-01`;
        const monthIncome = await db('transactions')
            .where('user_id', userId)
            .where('amount', '>', 0)
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .whereNull('transfer_account_id')
            .sum('amount as total')
            .first();

        const monthExpenses = await db('transactions')
            .where('user_id', userId)
            .where('amount', '<', 0)
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .whereNull('transfer_account_id')
            .sum('amount as total')
            .first();

        const monthAssigned = await db('budget_allocations')
            .where('user_id', userId)
            .where('month', month)
            .sum('assigned as total')
            .first();

        return {
            to_be_budgeted: toBeBudgeted,
            total_income: totalIncome?.total || 0,
            total_assigned: totalAssigned?.total || 0,
            month_income: monthIncome?.total || 0,
            month_expenses: monthExpenses?.total || 0,
            month_assigned: monthAssigned?.total || 0
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
    // Get all months before the current month
    const allAllocations = await db('budget_allocations')
        .where('user_id', userId)
        .where('month', '<', currentMonth)
        .select('category_id')
        .sum('assigned as total_assigned')
        .groupBy('category_id');

    const priorTransactions = await db('transactions')
        .where('user_id', userId)
        .where('date', '<', `${currentMonth}-01`)
        .whereNotNull('category_id')
        .select('category_id')
        .sum('amount as total_activity')
        .groupBy('category_id');

    const result = {};
    allAllocations.forEach(a => {
        result[a.category_id] = (result[a.category_id] || 0) + (a.total_assigned || 0);
    });
    priorTransactions.forEach(t => {
        result[t.category_id] = (result[t.category_id] || 0) + (t.total_activity || 0);
    });

    return result;
}

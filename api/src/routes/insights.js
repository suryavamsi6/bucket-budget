import db from '../db/knex.js';
import authenticate from '../middleware/auth.js';

export default async function insightRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    fastify.get('/', async (request) => {
        const userId = request.user.id;
        const insights = [];

        const now = new Date();
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

        // Get this month's spending by category
        const thisMonthSpending = await db('transactions')
            .join('accounts', 'transactions.account_id', 'accounts.id')
            .leftJoin('categories', 'transactions.category_id', 'categories.id')
            .where('accounts.user_id', userId)
            .where('transactions.date', '>=', `${thisMonth}-01`)
            .where('transactions.amount', '<', 0)
            .groupBy('transactions.category_id')
            .select('categories.name as category_name', 'transactions.category_id')
            .sum('transactions.amount as total');

        // Get last month's spending by category
        const lastMonthSpending = await db('transactions')
            .join('accounts', 'transactions.account_id', 'accounts.id')
            .leftJoin('categories', 'transactions.category_id', 'categories.id')
            .where('accounts.user_id', userId)
            .where('transactions.date', '>=', `${lastMonthStr}-01`)
            .where('transactions.date', '<', `${thisMonth}-01`)
            .where('transactions.amount', '<', 0)
            .groupBy('transactions.category_id')
            .select('categories.name as category_name', 'transactions.category_id')
            .sum('transactions.amount as total');

        // Compare spending by category
        const lastMap = {};
        for (const row of lastMonthSpending) {
            lastMap[row.category_id] = row;
        }

        for (const row of thisMonthSpending) {
            const prev = lastMap[row.category_id];
            if (prev) {
                const thisAmt = Math.abs(parseFloat(row.total));
                const lastAmt = Math.abs(parseFloat(prev.total));
                const pctChange = lastAmt > 0 ? ((thisAmt - lastAmt) / lastAmt * 100) : 0;

                if (pctChange > 30) {
                    insights.push({
                        type: 'spending_increase',
                        severity: pctChange > 50 ? 'warning' : 'info',
                        icon: '📈',
                        title: `${row.category_name || 'Uncategorized'} spending up ${Math.round(pctChange)}%`,
                        description: `You've spent ${Math.round(pctChange)}% more on ${row.category_name || 'Uncategorized'} this month compared to last month.`,
                        category: row.category_name,
                        amount: thisAmt - lastAmt
                    });
                } else if (pctChange < -30) {
                    insights.push({
                        type: 'spending_decrease',
                        severity: 'success',
                        icon: '📉',
                        title: `${row.category_name || 'Uncategorized'} spending down ${Math.round(Math.abs(pctChange))}%`,
                        description: `Great job! You cut ${row.category_name || 'Uncategorized'} spending by ${Math.round(Math.abs(pctChange))}% vs last month.`,
                        category: row.category_name,
                        amount: lastAmt - thisAmt
                    });
                }
            }
        }

        // Budget overspend warning
        const budgetData = await db('budget_allocations')
            .join('categories', 'budget_allocations.category_id', 'categories.id')
            .join('category_groups', 'categories.group_id', 'category_groups.id')
            .where('category_groups.user_id', userId)
            .where('budget_allocations.month', thisMonth)
            .select('budget_allocations.category_id', 'budget_allocations.assigned', 'categories.name');

        for (const bud of budgetData) {
            const spent = thisMonthSpending.find(s => s.category_id === bud.category_id);
            if (spent) {
                const assigned = parseFloat(bud.assigned);
                const spentAmt = Math.abs(parseFloat(spent.total));
                const dayOfMonth = now.getDate();
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                const projectedSpend = (spentAmt / dayOfMonth) * daysInMonth;

                if (assigned > 0 && projectedSpend > assigned * 1.1) {
                    insights.push({
                        type: 'budget_overspend',
                        severity: 'warning',
                        icon: '⚠️',
                        title: `${bud.name} may overspend`,
                        description: `At this pace, you'll spend ~${Math.round(projectedSpend)} on ${bud.name}, exceeding your ${Math.round(assigned)} budget.`,
                        category: bud.name,
                        amount: projectedSpend - assigned
                    });
                }
            }
        }

        // Largest single expense
        const biggestExpense = await db('transactions')
            .join('accounts', 'transactions.account_id', 'accounts.id')
            .where('accounts.user_id', userId)
            .where('transactions.date', '>=', `${thisMonth}-01`)
            .where('transactions.amount', '<', 0)
            .orderBy('transactions.amount', 'asc')
            .first();

        if (biggestExpense) {
            insights.push({
                type: 'biggest_expense',
                severity: 'info',
                icon: '💸',
                title: `Biggest expense: ${biggestExpense.payee || 'Unknown'}`,
                description: `Your largest single expense this month was ${Math.abs(parseFloat(biggestExpense.amount)).toFixed(2)} to ${biggestExpense.payee || 'Unknown'}.`,
                amount: Math.abs(parseFloat(biggestExpense.amount))
            });
        }

        // Sort insights: warnings first, then info, then success
        const severityOrder = { warning: 0, info: 1, success: 2 };
        insights.sort((a, b) => (severityOrder[a.severity] || 1) - (severityOrder[b.severity] || 1));

        return insights;
    });
}

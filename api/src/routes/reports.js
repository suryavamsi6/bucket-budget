import db from '../db/knex.js';
import authenticate from '../middleware/auth.js';

export default async function reportRoutes(fastify) {
  fastify.addHook('preHandler', authenticate);

  // Spending by category (for pie/donut chart)
  fastify.get('/spending-by-category', async (request) => {
    const { from, to } = request.query;
    const userId = request.user.id;

    let query = db('transactions')
      .select('categories.name as category', 'category_groups.name as group', db.raw('SUM(ABS(amount)) as total'))
      .leftJoin('categories', 'transactions.category_id', 'categories.id')
      .leftJoin('category_groups', 'categories.group_id', 'category_groups.id')
      .where('transactions.user_id', userId)
      .where('transactions.amount', '<', 0)
      .whereNull('transactions.transfer_account_id')
      .whereNotNull('transactions.category_id')
      .groupBy('transactions.category_id')
      .orderBy('total', 'desc');

    if (from) query = query.where('transactions.date', '>=', from);
    if (to) query = query.where('transactions.date', '<=', to);

    return await query;
  });

  // Income vs Expense by month (for bar chart)
  fastify.get('/income-vs-expense', async (request) => {
    const months = parseInt(request.query.months || '12');
    const userId = request.user.id;

    const data = await db.raw(`
      SELECT
        substr(date, 1, 7) as month,
        SUM(CASE WHEN amount > 0 AND transfer_account_id IS NULL THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN amount < 0 AND transfer_account_id IS NULL THEN ABS(amount) ELSE 0 END) as expenses
      FROM transactions
      WHERE user_id = ?
      GROUP BY substr(date, 1, 7)
      ORDER BY month DESC
      LIMIT ?
    `, [userId, months]);

    return data.reverse();
  });

  // Net worth over time (for line chart)
  fastify.get('/net-worth', async (request) => {
    const months = parseInt(request.query.months || '12');
    const userId = request.user.id;

    const data = await db.raw(`
      WITH months AS (
        SELECT DISTINCT substr(date, 1, 7) as month
        FROM transactions
        WHERE user_id = ?
        ORDER BY month DESC
        LIMIT ?
      )
      SELECT
        m.month,
        (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE substr(date, 1, 7) <= m.month AND user_id = ?) as net_worth
      FROM months m
      ORDER BY m.month ASC
    `, [userId, months, userId]);

    return data;
  });

  // Budget vs Actual for a month (for horizontal bar chart)
  fastify.get('/budget-vs-actual/:month', async (request) => {
    const { month } = request.params;
    const userId = request.user.id;
    const startDate = `${month}-01`;
    const endDate = `${month}-31`;

    const categories = await db('categories')
      .select('categories.id', 'categories.name', 'category_groups.name as group_name')
      .leftJoin('category_groups', 'categories.group_id', 'category_groups.id')
      .where('categories.user_id', userId)
      .orderBy('category_groups.sort_order')
      .orderBy('categories.sort_order');

    const allocations = await db('budget_allocations').where({ month, user_id: userId });
    const allocationMap = {};
    allocations.forEach(a => { allocationMap[a.category_id] = a.assigned || 0; });

    const activity = await db('transactions')
      .select('category_id', db.raw('SUM(ABS(amount)) as spent'))
      .where('user_id', userId)
      .where('amount', '<', 0)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .whereNotNull('category_id')
      .groupBy('category_id');

    const activityMap = {};
    activity.forEach(a => { activityMap[a.category_id] = a.spent || 0; });

    return categories.map(cat => ({
      category: cat.name,
      group: cat.group_name,
      budgeted: allocationMap[cat.id] || 0,
      actual: activityMap[cat.id] || 0
    }));
  });

  // Monthly spending trend (for multi-line chart)
  fastify.get('/spending-trend', async (request) => {
    const months = parseInt(request.query.months || '6');
    const userId = request.user.id;

    const data = await db.raw(`
      SELECT
        substr(t.date, 1, 7) as month,
        c.name as category,
        SUM(ABS(t.amount)) as total
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.amount < 0
        AND t.transfer_account_id IS NULL
        AND t.category_id IS NOT NULL
        AND t.user_id = ?
      GROUP BY substr(t.date, 1, 7), t.category_id
      ORDER BY month DESC
      LIMIT ?
    `, [userId, months * 20]);

    // Reshape into { month, cat1: val, cat2: val, ... }
    const monthMap = {};
    const allCategories = new Set();

    data.forEach(row => {
      if (!monthMap[row.month]) monthMap[row.month] = { month: row.month };
      monthMap[row.month][row.category] = row.total;
      allCategories.add(row.category);
    });

    return {
      data: Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month)),
      categories: [...allCategories]
    };
  });
}

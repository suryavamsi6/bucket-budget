import db from '../db/knex.js';
import authenticate from '../middleware/auth.js';
import { generateTransactionsPDF, generateBudgetPDF, generateNetWorthPDF } from '../services/pdf.js';

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

  // Net worth over time (for Area Chart)
  fastify.get('/net-worth', async (request) => {
    const months = parseInt(request.query.months || '12');
    const userId = request.user.id;

    // To compute historical net worth accurately:
    // 1. Get current balances of all accounts (assets = positive balance accounts, liabilities = credit cards/loans)
    // 2. Walk backwards month by month, subtracting the net transaction delta for that month to find the starting balance of the previous month.

    // Step 1: Current Balances
    const accounts = await db('accounts').where('user_id', userId);
    let currentAssets = 0;
    let currentLiabilities = 0;

    accounts.forEach(acc => {
      const bal = parseFloat(acc.balance || 0);
      // Types: checking, savings, cash, investment (usually assets) | credit_card, loan (liabilities)
      if (acc.type === 'credit_card' || acc.type === 'loan' || bal < 0) {
        currentLiabilities += Math.abs(bal);
      } else {
        currentAssets += bal;
      }
    });

    // Step 2: Get net flow per month
    // A positive flow means balance went up. So to go back in time, we SUBTRACT the flow.
    const flows = await db.raw(`
      SELECT 
        substr(transactions.date, 1, 7) as month,
        accounts.type as account_type,
        SUM(amount) as net_flow
      FROM transactions
      JOIN accounts ON transactions.account_id = accounts.id
      WHERE transactions.user_id = ?
      GROUP BY substr(transactions.date, 1, 7), accounts.type
      ORDER BY month DESC
    `, [userId]);

    const history = [];
    const now = new Date();

    let runnerAssets = currentAssets;
    let runnerLiabilities = currentLiabilities;

    // Build the last N months array (e.g. 2026-02, 2026-01, 2025-12...)
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const monthStr = `${yyyy}-${mm}`;

      // Push current runner state for this month
      // Wait, the "current balance" is the balance at the END of the month.
      history.unshift({
        month: monthStr,
        assets: parseFloat(runnerAssets.toFixed(2)),
        liabilities: parseFloat(runnerLiabilities.toFixed(2)),
        net_worth: parseFloat((runnerAssets - runnerLiabilities).toFixed(2))
      });

      // To prepare the runner for the PREVIOUS month, we subtract THIS month's flow.
      const monthFlows = flows.filter(f => f.month === monthStr);
      monthFlows.forEach(f => {
        const flow = parseFloat(f.net_flow);
        if (f.account_type === 'credit_card' || f.account_type === 'loan') {
          // If I spent $100 on a CC (flow = -100), the CC balance (liability) went UP by 100.
          // So to go backwards, if CC balance is 500 now, before this month it was 400.
          // Flow is -100. CC balance = 500. CC balance backwards = 500 - Math.abs(-100) = 400.
          // If I paid $100 (flow = +100), liability went DOWN by 100. Backwards = 500 + 100 = 600.
          runnerLiabilities += flow;
        } else {
          // Asset account: If I got paid $1000 (flow = +1000), balance went up. 
          // Backwards = Current Asset - 1000
          runnerAssets -= flow;
        }
      });
    }

    return history;
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

  // Top Payees Leaderboard (for bar chart or list)
  fastify.get('/payee-leaderboard', async (request) => {
    const { from, to, limit = 10 } = request.query;
    const userId = request.user.id;

    let query = db('transactions')
      .select('payee', db.raw('SUM(ABS(amount)) as total_spent'), db.raw('COUNT(id) as transaction_count'))
      .where('user_id', userId)
      .where('amount', '<', 0)
      .whereNull('transfer_account_id')
      .groupBy('payee')
      .orderBy('total_spent', 'desc')
      .limit(parseInt(limit));

    if (from) query = query.where('date', '>=', from);
    if (to) query = query.where('date', '<=', to);

    return await query;
  });

  // Spending Heatmap (for Calendar heatmap)
  fastify.get('/spending-heatmap', async (request) => {
    const months = parseInt(request.query.months || '12');
    const userId = request.user.id;

    // Get daily spend sums for the last X months
    const data = await db.raw(`
      SELECT
        date,
        SUM(ABS(amount)) as total,
        COUNT(id) as count
      FROM transactions
      WHERE user_id = ?
        AND amount < 0
        AND transfer_account_id IS NULL
        AND date >= date('now', '-' || ? || ' months')
      GROUP BY date
      ORDER BY date ASC
    `, [userId, months]);

    // Fastify / SQLite driver might return differently formatted arrays, reshape simple array
    return data.map(row => ({
      date: row.date,
      total: parseFloat(row.total || 0),
      count: parseInt(row.count || 0)
    }));
  });

  // ── Forecasting Endpoints ──────────────────────────────────────────────

  // Cashflow forecast – uses last N months of income/expense to project forward
  fastify.get('/cashflow-forecast', async (request) => {
    const forecastMonths = parseInt(request.query.months || '6');
    const lookback = parseInt(request.query.lookback || '6');
    const userId = request.user.id;

    const data = await db.raw(`
      SELECT
        substr(date, 1, 7) as month,
        SUM(CASE WHEN amount > 0 AND transfer_account_id IS NULL THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN amount < 0 AND transfer_account_id IS NULL THEN amount ELSE 0 END) as expenses
      FROM transactions
      WHERE user_id = ?
      GROUP BY substr(date, 1, 7)
      ORDER BY month DESC
      LIMIT ?
    `, [userId, lookback]);

    const historical = data.reverse();
    if (historical.length === 0) return { historical: [], forecast: [] };

    // Simple moving average
    const avgIncome = historical.reduce((s, r) => s + parseFloat(r.income || 0), 0) / historical.length;
    const avgExpenses = historical.reduce((s, r) => s + parseFloat(r.expenses || 0), 0) / historical.length;

    // Linear trend (simple least-squares on net savings)
    const nets = historical.map(r => parseFloat(r.income || 0) + parseFloat(r.expenses || 0));
    const n = nets.length;
    const xMean = (n - 1) / 2;
    const yMean = nets.reduce((s, v) => s + v, 0) / n;
    let num = 0, den = 0;
    nets.forEach((y, i) => { num += (i - xMean) * (y - yMean); den += (i - xMean) ** 2; });
    const slope = den !== 0 ? num / den : 0;

    // Project forward
    const now = new Date();
    const lastMonth = historical[historical.length - 1]?.month;
    const forecast = [];

    for (let i = 1; i <= forecastMonths; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const trendAdjust = slope * (n + i - 1 - xMean);
      const projectedNet = yMean + trendAdjust;
      forecast.push({
        month: monthStr,
        projected_income: parseFloat(avgIncome.toFixed(2)),
        projected_expenses: parseFloat(avgExpenses.toFixed(2)),
        projected_net: parseFloat(projectedNet.toFixed(2)),
        is_forecast: true
      });
    }

    return {
      historical: historical.map(h => ({
        month: h.month,
        income: parseFloat(h.income || 0),
        expenses: Math.abs(parseFloat(h.expenses || 0)),
        net: parseFloat(h.income || 0) + parseFloat(h.expenses || 0)
      })),
      forecast,
      averages: {
        income: parseFloat(avgIncome.toFixed(2)),
        expenses: parseFloat(Math.abs(avgExpenses).toFixed(2)),
        net_savings: parseFloat((avgIncome + avgExpenses).toFixed(2)),
        trend_slope: parseFloat(slope.toFixed(2))
      }
    };
  });

  // Spending forecast – project per-category spending using historical averages + seasonality
  fastify.get('/spending-forecast', async (request) => {
    const forecastMonths = parseInt(request.query.months || '3');
    const userId = request.user.id;

    // Last 12 months of spending by category
    const data = await db.raw(`
      SELECT
        substr(t.date, 1, 7) as month,
        c.id as category_id,
        c.name as category,
        SUM(ABS(t.amount)) as total
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.amount < 0
        AND t.transfer_account_id IS NULL
        AND t.category_id IS NOT NULL
        AND t.user_id = ?
        AND t.date >= date('now', '-12 months')
      GROUP BY substr(t.date, 1, 7), t.category_id
      ORDER BY month
    `, [userId]);

    // Build per-category monthly data
    const catData = {};
    data.forEach(row => {
      if (!catData[row.category_id]) catData[row.category_id] = { name: row.category, months: {} };
      catData[row.category_id].months[row.month] = parseFloat(row.total || 0);
    });

    const now = new Date();
    const forecast = [];

    for (let i = 1; i <= forecastMonths; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthOfYear = d.getMonth() + 1;
      const categories = [];

      for (const [catId, info] of Object.entries(catData)) {
        const vals = Object.values(info.months);
        const avg = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
        // Simple seasonality: check if same month last year exists
        const sameMonthLastYear = `${d.getFullYear() - 1}-${String(monthOfYear).padStart(2, '0')}`;
        const seasonal = info.months[sameMonthLastYear];
        const projected = seasonal ? (avg * 0.6 + seasonal * 0.4) : avg;

        if (projected > 0) {
          categories.push({
            category_id: parseInt(catId),
            category: info.name,
            projected: parseFloat(projected.toFixed(2)),
            average: parseFloat(avg.toFixed(2)),
            data_points: vals.length
          });
        }
      }

      forecast.push({
        month: monthStr,
        total: parseFloat(categories.reduce((s, c) => s + c.projected, 0).toFixed(2)),
        categories: categories.sort((a, b) => b.projected - a.projected)
      });
    }

    return forecast;
  });

  // Net worth forecast – project net worth forward using trend
  fastify.get('/net-worth-forecast', async (request) => {
    const forecastMonths = parseInt(request.query.months || '12');
    const userId = request.user.id;

    // Get current net worth history (reusing logic from net-worth endpoint)
    const accounts = await db('accounts').where('user_id', userId);
    let currentAssets = 0, currentLiabilities = 0;

    accounts.forEach(acc => {
      const bal = parseFloat(acc.balance || 0);
      if (acc.type === 'credit_card' || acc.type === 'loan' || bal < 0) {
        currentLiabilities += Math.abs(bal);
      } else {
        currentAssets += bal;
      }
    });

    const flows = await db.raw(`
      SELECT 
        substr(transactions.date, 1, 7) as month,
        accounts.type as account_type,
        SUM(amount) as net_flow
      FROM transactions
      JOIN accounts ON transactions.account_id = accounts.id
      WHERE transactions.user_id = ?
      GROUP BY substr(transactions.date, 1, 7), accounts.type
      ORDER BY month DESC
    `, [userId]);

    // Build 12-month history
    const history = [];
    const now = new Date();
    let ra = currentAssets, rl = currentLiabilities;

    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      history.unshift({ month: monthStr, net_worth: parseFloat((ra - rl).toFixed(2)) });

      const monthFlows = flows.filter(f => f.month === monthStr);
      monthFlows.forEach(f => {
        const flow = parseFloat(f.net_flow);
        if (f.account_type === 'credit_card' || f.account_type === 'loan') {
          rl += flow;
        } else {
          ra -= flow;
        }
      });
    }

    // Linear regression on net worth history
    const nwVals = history.map(h => h.net_worth);
    const nn = nwVals.length;
    const xm = (nn - 1) / 2;
    const ym = nwVals.reduce((s, v) => s + v, 0) / nn;
    let numerator = 0, denominator = 0;
    nwVals.forEach((y, i) => { numerator += (i - xm) * (y - ym); denominator += (i - xm) ** 2; });
    const nwSlope = denominator !== 0 ? numerator / denominator : 0;
    const nwIntercept = ym - nwSlope * xm;

    const forecast = [];
    for (let i = 1; i <= forecastMonths; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const projected = nwIntercept + nwSlope * (nn + i - 1);
      forecast.push({
        month: monthStr,
        projected_net_worth: parseFloat(projected.toFixed(2)),
        is_forecast: true
      });
    }

    return {
      history,
      forecast,
      trend: {
        monthly_change: parseFloat(nwSlope.toFixed(2)),
        current_net_worth: parseFloat((currentAssets - currentLiabilities).toFixed(2))
      }
    };
  });

  // ── PDF / CSV Export Endpoints ─────────────────────────────────────────

  // Export transactions as PDF
  fastify.get('/export/transactions-pdf', async (request, reply) => {
    const { from, to, account_id, category_id } = request.query;
    const userId = request.user.id;

    let query = db('transactions')
      .select(
        'transactions.*',
        'categories.name as category_name',
        'accounts.name as account_name'
      )
      .leftJoin('categories', 'transactions.category_id', 'categories.id')
      .leftJoin('accounts', 'transactions.account_id', 'accounts.id')
      .where('transactions.user_id', userId)
      .orderBy('transactions.date', 'desc');

    if (from) query = query.where('transactions.date', '>=', from);
    if (to) query = query.where('transactions.date', '<=', to);
    if (account_id) query = query.where('transactions.account_id', account_id);
    if (category_id) query = query.where('transactions.category_id', category_id);

    const transactions = await query;
    const filters = { from, to, account_id, category_id };
    const pdfBuffer = await generateTransactionsPDF(transactions, filters);

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="transactions-${from || 'all'}-to-${to || 'now'}.pdf"`);
    return reply.send(pdfBuffer);
  });

  // Export budget as PDF
  fastify.get('/export/budget-pdf/:month', async (request, reply) => {
    const { month } = request.params;
    const userId = request.user.id;

    const groups = await db('category_groups').where('user_id', userId).orderBy('sort_order');
    const categories = await db('categories').where('user_id', userId).orderBy('sort_order');
    const allocations = await db('budget_allocations').where({ month, user_id: userId });

    const startDate = `${month}-01`;
    const endDate = `${month}-31`;

    const activity = await db('transactions')
      .select('category_id', db.raw('SUM(amount) as total'))
      .where('user_id', userId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .whereNotNull('category_id')
      .groupBy('category_id');

    const activityMap = {};
    activity.forEach(a => { activityMap[a.category_id] = a.total || 0; });

    const allocationMap = {};
    allocations.forEach(a => { allocationMap[a.category_id] = a.assigned || 0; });

    const budgetData = groups.map(group => ({
      group: group.name,
      categories: categories
        .filter(c => c.group_id === group.id)
        .map(cat => ({
          name: cat.name,
          assigned: allocationMap[cat.id] || 0,
          activity: activityMap[cat.id] || 0,
          available: (allocationMap[cat.id] || 0) + (activityMap[cat.id] || 0)
        }))
    }));

    const summary = {
      total_assigned: Object.values(allocationMap).reduce((s, v) => s + v, 0),
      total_activity: Object.values(activityMap).reduce((s, v) => s + v, 0)
    };

    const pdfBuffer = await generateBudgetPDF(budgetData, month, summary);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="budget-${month}.pdf"`);
    return reply.send(pdfBuffer);
  });

  // Export net worth as PDF
  fastify.get('/export/net-worth-pdf', async (request, reply) => {
    const months = parseInt(request.query.months || '12');
    const userId = request.user.id;

    const accounts = await db('accounts').where('user_id', userId);
    let currentAssets = 0, currentLiabilities = 0;

    accounts.forEach(acc => {
      const bal = parseFloat(acc.balance || 0);
      if (acc.type === 'credit_card' || acc.type === 'loan' || bal < 0) {
        currentLiabilities += Math.abs(bal);
      } else {
        currentAssets += bal;
      }
    });

    const flows = await db.raw(`
      SELECT 
        substr(transactions.date, 1, 7) as month,
        accounts.type as account_type,
        SUM(amount) as net_flow
      FROM transactions
      JOIN accounts ON transactions.account_id = accounts.id
      WHERE transactions.user_id = ?
      GROUP BY substr(transactions.date, 1, 7), accounts.type
      ORDER BY month DESC
    `, [userId]);

    const history = [];
    const now = new Date();
    let ra = currentAssets, rl = currentLiabilities;

    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      history.unshift({
        month: monthStr,
        assets: parseFloat(ra.toFixed(2)),
        liabilities: parseFloat(rl.toFixed(2)),
        net_worth: parseFloat((ra - rl).toFixed(2))
      });

      const monthFlows = flows.filter(f => f.month === monthStr);
      monthFlows.forEach(f => {
        const flow = parseFloat(f.net_flow);
        if (f.account_type === 'credit_card' || f.account_type === 'loan') {
          rl += flow;
        } else {
          ra -= flow;
        }
      });
    }

    const pdfBuffer = await generateNetWorthPDF(history);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="net-worth.pdf"`);
    return reply.send(pdfBuffer);
  });

  // Export transactions as CSV
  fastify.get('/export/transactions-csv', async (request, reply) => {
    const { from, to, account_id, category_id } = request.query;
    const userId = request.user.id;

    let query = db('transactions')
      .select(
        'transactions.date',
        'transactions.payee',
        'transactions.memo',
        'transactions.amount',
        'categories.name as category',
        'accounts.name as account',
        'transactions.cleared'
      )
      .leftJoin('categories', 'transactions.category_id', 'categories.id')
      .leftJoin('accounts', 'transactions.account_id', 'accounts.id')
      .where('transactions.user_id', userId)
      .orderBy('transactions.date', 'desc');

    if (from) query = query.where('transactions.date', '>=', from);
    if (to) query = query.where('transactions.date', '<=', to);
    if (account_id) query = query.where('transactions.account_id', account_id);
    if (category_id) query = query.where('transactions.category_id', category_id);

    const transactions = await query;

    const headers = ['Date', 'Payee', 'Memo', 'Amount', 'Category', 'Account', 'Cleared'];
    const rows = transactions.map(t => [
      t.date,
      `"${(t.payee || '').replace(/"/g, '""')}"`,
      `"${(t.memo || '').replace(/"/g, '""')}"`,
      t.amount,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      `"${(t.account || '').replace(/"/g, '""')}"`,
      t.cleared ? 'Yes' : 'No'
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="transactions-export.csv"`);
    return reply.send(csv);
  });
}

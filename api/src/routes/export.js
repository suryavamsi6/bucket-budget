import db from '../db/knex.js';
import authenticate from '../middleware/auth.js';

// Build financial context markdown (reused by AI route too)
export async function buildFinancialContext(userId, sections = 'all', months = 6) {
    const sectionSet = sections === 'all'
        ? new Set(['accounts', 'transactions', 'budget', 'goals', 'debts', 'investments', 'subscriptions', 'insights'])
        : new Set(sections.split(',').map(s => s.trim()));

    const settingsRows = await db('settings').where('user_id', userId);
    const settings = {};
    settingsRows.forEach(r => { settings[r.key] = r.value; });
    const currency = settings.currency || 'USD';
    const currSymbol = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥' }[currency] || currency + ' ';

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const currentMonth = now.toISOString().slice(0, 7);

    let md = `# BucketBudget Financial Summary\n`;
    md += `> Generated: ${dateStr} | Currency: ${currency}\n\n`;

    // --- ACCOUNTS ---
    if (sectionSet.has('accounts')) {
        const accounts = await db('accounts').where({ user_id: userId, closed: false }).orderBy('type');
        const total = accounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0);
        md += `## Accounts\n\n`;
        md += `| Account | Type | Balance |\n|---------|------|---------|\n`;
        for (const a of accounts) {
            md += `| ${a.name} | ${a.type.replace('_', ' ')} | ${currSymbol}${parseFloat(a.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })} |\n`;
        }
        md += `| **Total Net Worth** | | **${currSymbol}${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}** |\n\n`;
    }

    // --- BUDGET ---
    if (sectionSet.has('budget')) {
        const groups = await db('category_groups').where('user_id', userId);
        const categories = await db('categories').where('user_id', userId);
        const allocations = await db('budget_allocations').where({ user_id: userId, month: currentMonth });
        const spending = await db('transactions')
            .select('category_id', db.raw('SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as spent'))
            .where('user_id', userId)
            .where('date', '>=', `${currentMonth}-01`)
            .where('date', '<=', `${currentMonth}-31`)
            .groupBy('category_id');

        const spendMap = {};
        spending.forEach(s => { spendMap[s.category_id] = parseFloat(s.spent) || 0; });
        const allocMap = {};
        allocations.forEach(a => { allocMap[a.category_id] = parseFloat(a.assigned) || 0; });

        md += `## Budget — ${currentMonth}\n\n`;
        md += `| Group | Category | Assigned | Spent | Available |\n|-------|----------|----------|-------|-----------|\n`;

        for (const g of groups) {
            const cats = categories.filter(c => c.group_id === g.id);
            for (const c of cats) {
                const assigned = allocMap[c.id] || 0;
                const spent = spendMap[c.id] || 0;
                const available = assigned - spent;
                const flag = available < 0 ? ' ⚠️' : '';
                md += `| ${g.name} | ${c.name} | ${currSymbol}${assigned.toFixed(2)} | ${currSymbol}${spent.toFixed(2)} | ${currSymbol}${available.toFixed(2)}${flag} |\n`;
            }
        }
        md += `\n`;
    }

    // --- TRANSACTIONS ---
    if (sectionSet.has('transactions')) {
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - months);
        const cutoffStr = cutoff.toISOString().split('T')[0];

        const txns = await db('transactions')
            .select('transactions.*', 'accounts.name as account_name', 'categories.name as category_name')
            .leftJoin('accounts', 'transactions.account_id', 'accounts.id')
            .leftJoin('categories', 'transactions.category_id', 'categories.id')
            .where('transactions.user_id', userId)
            .where('transactions.date', '>=', cutoffStr)
            .orderBy('transactions.date', 'desc');

        md += `## Transactions (Last ${months} Months)\n\n`;
        md += `Total: ${txns.length} transactions\n\n`;
        md += `| Date | Payee | Category | Account | Amount |\n|------|-------|----------|---------|--------|\n`;
        for (const t of txns) {
            const amt = parseFloat(t.amount);
            const sign = amt >= 0 ? '+' : '';
            md += `| ${t.date} | ${t.payee || '—'} | ${t.category_name || '—'} | ${t.account_name || '—'} | ${sign}${currSymbol}${Math.abs(amt).toFixed(2)} |\n`;
        }

        // Monthly spending summary
        const monthlySummary = {};
        for (const t of txns) {
            const m = t.date.slice(0, 7);
            if (!monthlySummary[m]) monthlySummary[m] = { income: 0, expenses: 0 };
            const amt = parseFloat(t.amount);
            if (amt > 0) monthlySummary[m].income += amt;
            else monthlySummary[m].expenses += Math.abs(amt);
        }
        md += `\n### Monthly Summary\n\n`;
        md += `| Month | Income | Expenses | Net |\n|-------|--------|----------|-----|\n`;
        for (const [m, data] of Object.entries(monthlySummary).sort()) {
            const net = data.income - data.expenses;
            md += `| ${m} | ${currSymbol}${data.income.toFixed(2)} | ${currSymbol}${data.expenses.toFixed(2)} | ${net >= 0 ? '+' : ''}${currSymbol}${net.toFixed(2)} |\n`;
        }

        // Top spending categories
        const catSpending = {};
        for (const t of txns) {
            if (parseFloat(t.amount) < 0) {
                const cat = t.category_name || 'Uncategorized';
                catSpending[cat] = (catSpending[cat] || 0) + Math.abs(parseFloat(t.amount));
            }
        }
        const topCats = Object.entries(catSpending).sort((a, b) => b[1] - a[1]).slice(0, 10);
        md += `\n### Top Spending Categories\n\n`;
        md += `| Category | Total Spent |\n|----------|------------|\n`;
        for (const [cat, total] of topCats) {
            md += `| ${cat} | ${currSymbol}${total.toFixed(2)} |\n`;
        }
        md += `\n`;
    }

    // --- GOALS ---
    if (sectionSet.has('goals')) {
        try {
            const goals = await db('goals').where('user_id', userId);
            if (goals.length > 0) {
                md += `## Savings Goals\n\n`;
                md += `| Goal | Target | Saved | Progress | Deadline | Status |\n|------|--------|-------|----------|----------|--------|\n`;
                for (const g of goals) {
                    const target = parseFloat(g.target_amount);
                    const saved = parseFloat(g.saved_amount);
                    const pct = target > 0 ? ((saved / target) * 100).toFixed(1) : '0.0';
                    md += `| ${g.icon || ''} ${g.name} | ${currSymbol}${target.toFixed(2)} | ${currSymbol}${saved.toFixed(2)} | ${pct}% | ${g.target_date || '—'} | ${g.status} |\n`;
                }
                md += `\n`;
            }
        } catch (e) { /* table may not exist */ }
    }

    // --- INVESTMENTS ---
    if (sectionSet.has('investments')) {
        try {
            const investments = await db('investments').where('user_id', userId);
            if (investments.length > 0) {
                md += `## Investments\n\n`;
                md += `| Name | Type | Quantity | Avg Price | Current Price | Current Value | P&L | P&L % |\n|------|------|----------|-----------|---------------|---------------|-----|-------|\n`;
                let totalValue = 0, totalCost = 0;
                for (const inv of investments) {
                    const qty = parseFloat(inv.quantity);
                    const avg = parseFloat(inv.average_price);
                    const cur = parseFloat(inv.current_price);
                    const value = qty * cur;
                    const cost = qty * avg;
                    const pnl = value - cost;
                    const pnlPct = cost > 0 ? ((pnl / cost) * 100).toFixed(1) : '0.0';
                    totalValue += value;
                    totalCost += cost;
                    md += `| ${inv.name} | ${inv.type} | ${qty} | ${currSymbol}${avg.toFixed(2)} | ${currSymbol}${cur.toFixed(2)} | ${currSymbol}${value.toFixed(2)} | ${pnl >= 0 ? '+' : ''}${currSymbol}${pnl.toFixed(2)} | ${pnlPct}% |\n`;
                }
                const totalPnl = totalValue - totalCost;
                md += `| **Total** | | | | | **${currSymbol}${totalValue.toFixed(2)}** | **${totalPnl >= 0 ? '+' : ''}${currSymbol}${totalPnl.toFixed(2)}** | |\n\n`;
            }
        } catch (e) { /* table may not exist */ }
    }

    // --- DEBTS ---
    if (sectionSet.has('debts')) {
        try {
            const debts = await db('debts').where('user_id', userId);
            if (debts.length > 0) {
                md += `## Debts\n\n`;
                md += `| Name | Type | Balance | Interest Rate | Min Payment | Payoff Months | Total Interest |\n|------|------|---------|---------------|-------------|---------------|----------------|\n`;
                let totalDebt = 0;
                for (const d of debts) {
                    totalDebt += parseFloat(d.balance);
                    md += `| ${d.name} | ${d.type} | ${currSymbol}${parseFloat(d.balance).toFixed(2)} | ${d.interest_rate}% | ${currSymbol}${parseFloat(d.minimum_payment).toFixed(2)} | ${d.months_to_payoff || '—'} | ${currSymbol}${parseFloat(d.total_interest || 0).toFixed(2)} |\n`;
                }
                md += `| **Total Debt** | | **${currSymbol}${totalDebt.toFixed(2)}** | | | | |\n\n`;
            }
        } catch (e) { /* table may not exist */ }
    }

    // --- SUBSCRIPTIONS ---
    if (sectionSet.has('subscriptions')) {
        try {
            const subs = await db('subscriptions').where('user_id', userId);
            if (subs.length > 0) {
                md += `## Subscriptions\n\n`;
                md += `| Name | Amount | Frequency | Next Due | Status |\n|------|--------|-----------|----------|--------|\n`;
                let monthlyTotal = 0;
                for (const s of subs) {
                    const amt = Math.abs(parseFloat(s.amount));
                    const monthly = s.frequency === 'yearly' ? amt / 12 : s.frequency === 'quarterly' ? amt / 3 : amt;
                    monthlyTotal += s.status === 'active' ? monthly : 0;
                    md += `| ${s.name} | ${currSymbol}${amt.toFixed(2)} | ${s.frequency} | ${s.next_due_date || '—'} | ${s.status} |\n`;
                }
                md += `\n**Monthly subscription cost: ${currSymbol}${monthlyTotal.toFixed(2)}**\n\n`;
            }
        } catch (e) { /* table may not exist */ }
    }

    // --- INSIGHTS ---
    if (sectionSet.has('insights')) {
        md += `## Key Financial Insights\n\n`;

        // Net worth
        const accounts = await db('accounts').where({ user_id: userId, closed: false });
        const netWorth = accounts.reduce((s, a) => s + parseFloat(a.balance || 0), 0);

        // This month income/expenses
        const thisMonth = await db('transactions')
            .select(
                db.raw('SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income'),
                db.raw('SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expenses')
            )
            .where('user_id', userId)
            .where('date', '>=', `${currentMonth}-01`)
            .where('date', '<=', `${currentMonth}-31`)
            .first();

        const income = parseFloat(thisMonth?.income || 0);
        const expenses = parseFloat(thisMonth?.expenses || 0);
        const savingsRate = income > 0 ? ((income - expenses) / income * 100).toFixed(1) : '0.0';

        md += `- **Net Worth**: ${currSymbol}${netWorth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n`;
        md += `- **This Month Income**: ${currSymbol}${income.toFixed(2)}\n`;
        md += `- **This Month Expenses**: ${currSymbol}${expenses.toFixed(2)}\n`;
        md += `- **Savings Rate**: ${savingsRate}%\n`;
        md += `\n`;
    }

    return md;
}

export default async function exportRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    // Export endpoint — Markdown or JSON
    fastify.get('/', async (request, reply) => {
        const userId = request.user.id;
        const { sections = 'all', format = 'markdown', months = '6' } = request.query;

        if (format === 'json') {
            // Return raw data as JSON for programmatic use
            const data = {};
            const sectionSet = sections === 'all'
                ? new Set(['accounts', 'transactions', 'budget', 'goals', 'debts', 'investments', 'subscriptions'])
                : new Set(sections.split(','));

            if (sectionSet.has('accounts')) data.accounts = await db('accounts').where({ user_id: userId, closed: false });
            if (sectionSet.has('goals')) { try { data.goals = await db('goals').where('user_id', userId); } catch (e) { data.goals = []; } }
            if (sectionSet.has('debts')) { try { data.debts = await db('debts').where('user_id', userId); } catch (e) { data.debts = []; } }
            if (sectionSet.has('investments')) { try { data.investments = await db('investments').where('user_id', userId); } catch (e) { data.investments = []; } }
            if (sectionSet.has('subscriptions')) { try { data.subscriptions = await db('subscriptions').where('user_id', userId); } catch (e) { data.subscriptions = []; } }
            if (sectionSet.has('transactions')) {
                const cutoff = new Date();
                cutoff.setMonth(cutoff.getMonth() - parseInt(months));
                data.transactions = await db('transactions')
                    .select('transactions.*', 'accounts.name as account_name', 'categories.name as category_name')
                    .leftJoin('accounts', 'transactions.account_id', 'accounts.id')
                    .leftJoin('categories', 'transactions.category_id', 'categories.id')
                    .where('transactions.user_id', userId)
                    .where('transactions.date', '>=', cutoff.toISOString().split('T')[0])
                    .orderBy('transactions.date', 'desc');
            }
            return data;
        }

        // Default: Markdown
        const md = await buildFinancialContext(userId, sections, parseInt(months));
        reply.header('Content-Type', 'text/markdown; charset=utf-8');
        reply.header('Content-Disposition', `attachment; filename="bucket-budget-export-${new Date().toISOString().split('T')[0]}.md"`);
        return md;
    });
}

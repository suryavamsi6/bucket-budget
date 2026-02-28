import client from 'prom-client';
import db from '../db/knex.js';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Custom budget metrics
const totalBalance = new client.Gauge({
    name: 'budget_total_balance',
    help: 'Sum of all account balances',
    registers: [register]
});

const toBeBudgeted = new client.Gauge({
    name: 'budget_to_be_budgeted',
    help: 'Unassigned income',
    registers: [register]
});

const totalAssigned = new client.Gauge({
    name: 'budget_total_assigned',
    help: 'Total money assigned to categories',
    registers: [register]
});

const totalOverspent = new client.Gauge({
    name: 'budget_total_overspent',
    help: 'Sum of overspent category amounts',
    registers: [register]
});

const transactionsCount = new client.Gauge({
    name: 'budget_transactions_count',
    help: 'Total transaction count',
    registers: [register]
});

const monthlyIncome = new client.Gauge({
    name: 'budget_monthly_income',
    help: 'Current month income',
    registers: [register]
});

const monthlyExpenses = new client.Gauge({
    name: 'budget_monthly_expenses',
    help: 'Current month expenses (absolute value)',
    registers: [register]
});

const accountsCount = new client.Gauge({
    name: 'budget_accounts_count',
    help: 'Number of active accounts',
    registers: [register]
});

async function updateMetrics() {
    try {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const startDate = `${currentMonth}-01`;
        const endDate = `${currentMonth}-31`;

        // Total balance
        const balResult = await db('accounts').where('closed', false).sum('balance as total').first();
        totalBalance.set(balResult?.total || 0);

        // Accounts count
        const accCount = await db('accounts').where('closed', false).count('* as count').first();
        accountsCount.set(accCount?.count || 0);

        // Transactions count
        const txnCount = await db('transactions').count('* as count').first();
        transactionsCount.set(txnCount?.count || 0);

        // Total assigned
        const assignedResult = await db('budget_allocations').sum('assigned as total').first();
        totalAssigned.set(assignedResult?.total || 0);

        // To be budgeted
        const incomeAll = await db('transactions')
            .where('amount', '>', 0).whereNull('transfer_account_id')
            .sum('amount as total').first();
        toBeBudgeted.set((incomeAll?.total || 0) - (assignedResult?.total || 0));

        // Monthly income
        const monthInc = await db('transactions')
            .where('amount', '>', 0).whereNull('transfer_account_id')
            .where('date', '>=', startDate).where('date', '<=', endDate)
            .sum('amount as total').first();
        monthlyIncome.set(monthInc?.total || 0);

        // Monthly expenses
        const monthExp = await db('transactions')
            .where('amount', '<', 0).whereNull('transfer_account_id')
            .where('date', '>=', startDate).where('date', '<=', endDate)
            .sum('amount as total').first();
        monthlyExpenses.set(Math.abs(monthExp?.total || 0));

        // Overspent
        totalOverspent.set(0); // Simplified for now
    } catch (err) {
        console.error('Error updating metrics:', err);
    }
}

export default async function metricsRoutes(fastify) {
    fastify.get('/metrics', async (request, reply) => {
        await updateMetrics();
        reply.header('Content-Type', register.contentType);
        return register.metrics();
    });
}

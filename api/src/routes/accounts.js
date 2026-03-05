import db from '../db/knex.js';
import authenticate from '../middleware/auth.js';

export default async function accountRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    // List all accounts with cleared/uncleared balances
    fastify.get('/', async (request) => {
        const userId = request.user.id;
        const accounts = await db('accounts')
            .where('user_id', userId)
            .orderBy('sort_order');

        // Compute cleared/uncleared balances for all accounts
        const balances = await db('transactions')
            .select('account_id')
            .select(db.raw('SUM(amount) as total'))
            .select(db.raw('SUM(CASE WHEN cleared = 1 OR reconciled = 1 THEN amount ELSE 0 END) as cleared_total'))
            .where('user_id', userId)
            .groupBy('account_id');

        const balanceMap = {};
        balances.forEach(b => {
            balanceMap[b.account_id] = {
                cleared_balance: parseFloat(b.cleared_total || 0),
                uncleared_balance: parseFloat((b.total || 0) - (b.cleared_total || 0))
            };
        });

        accounts.forEach(a => {
            const bal = balanceMap[a.id] || { cleared_balance: 0, uncleared_balance: 0 };
            a.cleared_balance = parseFloat(bal.cleared_balance.toFixed(2));
            a.uncleared_balance = parseFloat(bal.uncleared_balance.toFixed(2));
        });

        return accounts;
    });

    // Get single account
    fastify.get('/:id', async (request, reply) => {
        const account = await db('accounts')
            .where({ id: request.params.id, user_id: request.user.id })
            .first();
        if (!account) return reply.code(404).send({ error: 'Account not found' });

        // Add cleared/uncleared balance
        const bal = await db('transactions')
            .select(db.raw('SUM(amount) as total'))
            .select(db.raw('SUM(CASE WHEN cleared = 1 OR reconciled = 1 THEN amount ELSE 0 END) as cleared_total'))
            .where({ account_id: account.id, user_id: request.user.id })
            .first();

        account.cleared_balance = parseFloat((bal?.cleared_total || 0));
        account.uncleared_balance = parseFloat(((bal?.total || 0) - (bal?.cleared_total || 0)));

        return account;
    });

    // Create account (with CC tracking auto-setup)
    fastify.post('/', async (request, reply) => {
        const { name, type, balance = 0, on_budget = true, is_credit_card_tracking = false } = request.body;
        const userId = request.user.id;
        if (!name || !type) return reply.code(400).send({ error: 'Name and type are required' });

        const maxSort = await db('accounts')
            .where('user_id', userId)
            .max('sort_order as max').first();
        const sort_order = (maxSort?.max || 0) + 1;

        const [id] = await db('accounts').insert({
            user_id: userId,
            name, type, balance, on_budget, sort_order,
            is_credit_card_tracking: type === 'credit_card' ? is_credit_card_tracking : false
        });

        // If starting balance != 0, create an initial balance transaction
        if (balance !== 0) {
            await db('transactions').insert({
                user_id: userId,
                account_id: id,
                date: new Date().toISOString().split('T')[0],
                payee: 'Starting Balance',
                amount: balance,
                cleared: true,
                memo: 'Initial account balance'
            });
        }

        // If CC tracking enabled, create the auto-managed payment category
        if (type === 'credit_card' && is_credit_card_tracking) {
            await setupCCPaymentCategory(userId, id, name);
        }

        const account = await db('accounts').where({ id, user_id: userId }).first();
        return reply.code(201).send(account);
    });

    // Update account
    fastify.put('/:id', async (request, reply) => {
        const userId = request.user.id;
        const { name, type, on_budget, closed, sort_order, is_credit_card_tracking, statement_balance } = request.body;
        const updates = {};
        if (name !== undefined) updates.name = name;
        if (type !== undefined) updates.type = type;
        if (on_budget !== undefined) updates.on_budget = on_budget;
        if (closed !== undefined) updates.closed = closed;
        if (sort_order !== undefined) updates.sort_order = sort_order;
        if (is_credit_card_tracking !== undefined) updates.is_credit_card_tracking = is_credit_card_tracking;
        if (statement_balance !== undefined) updates.statement_balance = statement_balance;
        updates.updated_at = new Date().toISOString();

        const existing = await db('accounts').where({ id: request.params.id, user_id: userId }).first();
        if (!existing) return reply.code(404).send({ error: 'Account not found' });

        await db('accounts')
            .where({ id: request.params.id, user_id: userId })
            .update(updates);

        // Handle CC tracking toggle
        if (is_credit_card_tracking !== undefined && is_credit_card_tracking !== existing.is_credit_card_tracking) {
            if (is_credit_card_tracking) {
                await setupCCPaymentCategory(userId, parseInt(request.params.id), name || existing.name);
            } else {
                // Remove CC payment link (category stays for history)
                await db('cc_payment_categories').where({ account_id: request.params.id }).del();
            }
        }

        const account = await db('accounts')
            .where({ id: request.params.id, user_id: userId })
            .first();

        return account;
    });

    // Delete account
    fastify.delete('/:id', async (request, reply) => {
        const deleted = await db('accounts')
            .where({ id: request.params.id, user_id: request.user.id })
            .del();
        if (!deleted) return reply.code(404).send({ error: 'Account not found' });
        return { success: true };
    });

    // Recalculate account balance from transactions
    fastify.post('/:id/recalculate', async (request, reply) => {
        const { id } = request.params;
        const userId = request.user.id;

        const account = await db('accounts').where({ id, user_id: userId }).first();
        if (!account) return reply.code(404).send({ error: 'Account not found' });

        const result = await db('transactions')
            .where({ account_id: id, user_id: userId })
            .sum('amount as total')
            .first();

        const balance = result?.total || 0;
        await db('accounts').where({ id, user_id: userId }).update({ balance, updated_at: new Date().toISOString() });
        return { id: parseInt(id), balance };
    });

    // Enhanced reconciliation endpoint
    fastify.post('/:id/reconcile', async (request, reply) => {
        const { id } = request.params;
        const { statementBalance, statementDate } = request.body;
        const userId = request.user.id;

        const account = await db('accounts').where({ id, user_id: userId }).first();
        if (!account) return reply.code(404).send({ error: 'Account not found' });

        const dateFilter = statementDate || new Date().toISOString().split('T')[0];

        // Mark cleared transactions as reconciled (up to statement date)
        const reconciledResult = await db('transactions')
            .where({ account_id: id, user_id: userId })
            .where('cleared', true)
            .where('reconciled', false)
            .where('date', '<=', dateFilter)
            .update({ reconciled: true });

        // Calculate current balance from all transactions
        const result = await db('transactions')
            .where({ account_id: id, user_id: userId })
            .sum('amount as total')
            .first();

        const currentBalance = parseFloat(result?.total || 0);
        const target = parseFloat(statementBalance);
        const adjustment = target - currentBalance;

        // Create adjustment transaction if needed
        if (Math.abs(adjustment) > 0.005) {
            await db('transactions').insert({
                user_id: userId,
                account_id: parseInt(id),
                date: dateFilter,
                payee: 'Reconciliation Adjustment',
                amount: adjustment,
                cleared: true,
                reconciled: true,
                memo: `Adjustment to match statement balance of ${target}`
            });
        }

        // Update account balance and statement_balance
        const newResult = await db('transactions')
            .where({ account_id: id, user_id: userId })
            .sum('amount as total')
            .first();

        await db('accounts')
            .where({ id, user_id: userId })
            .update({
                balance: newResult?.total || 0,
                statement_balance: target,
                updated_at: new Date().toISOString()
            });

        return {
            success: true,
            adjustment: parseFloat(adjustment.toFixed(2)),
            new_balance: parseFloat((newResult?.total || 0)),
            reconciled_count: reconciledResult,
            statement_date: dateFilter
        };
    });

    // Get CC payment info
    fastify.get('/:id/cc-payment-info', async (request) => {
        const userId = request.user.id;
        const accountId = request.params.id;

        const ccLink = await db('cc_payment_categories')
            .where({ account_id: accountId })
            .first();

        if (!ccLink) return { enabled: false };

        const category = await db('categories').where({ id: ccLink.category_id }).first();

        // Calculate: total on-budget spending on this CC this month
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const startDate = `${month}-01`;
        const endDate = `${month}-31`;

        const spending = await db('transactions')
            .where({ account_id: accountId, user_id: userId })
            .where('amount', '<', 0)
            .where('date', '>=', startDate)
            .where('date', '<=', endDate)
            .whereNotNull('category_id')
            .sum('amount as total')
            .first();

        // CC payment available = budgeted for CC payment category + any spending that auto-moved
        const allocation = await db('budget_allocations')
            .where({ category_id: ccLink.category_id, month, user_id: userId })
            .first();

        return {
            enabled: true,
            category_id: ccLink.category_id,
            category_name: category?.name || 'CC Payment',
            month_spending: Math.abs(parseFloat(spending?.total || 0)),
            budgeted_payment: parseFloat(allocation?.assigned || 0),
            register_balance: parseFloat((await db('transactions').where({ account_id: accountId, user_id: userId }).sum('amount as total').first())?.total || 0)
        };
    });
}

// Helper: setup CC payment category for YNAB-style tracking
async function setupCCPaymentCategory(userId, accountId, accountName) {
    // Find or create "Credit Card Payments" group
    let group = await db('category_groups')
        .where({ user_id: userId, name: 'Credit Card Payments' })
        .first();

    if (!group) {
        const maxSort = await db('category_groups')
            .where('user_id', userId)
            .max('sort_order as max').first();
        const [groupId] = await db('category_groups').insert({
            user_id: userId,
            name: 'Credit Card Payments',
            sort_order: (maxSort?.max || 0) + 1
        });
        group = { id: groupId };
    }

    // Create a category for this CC account
    const catName = `${accountName} Payment`;
    let category = await db('categories')
        .where({ user_id: userId, group_id: group.id, name: catName })
        .first();

    if (!category) {
        const [catId] = await db('categories').insert({
            user_id: userId,
            group_id: group.id,
            name: catName,
            sort_order: 0
        });
        category = { id: catId };
    }

    // Link CC account to payment category
    const existing = await db('cc_payment_categories').where({ account_id: accountId }).first();
    if (!existing) {
        await db('cc_payment_categories').insert({
            account_id: accountId,
            category_id: category.id
        });
    }
}

import db from '../db/knex.js';

export async function processRecurringTransactions() {
    try {
        const today = new Date().toISOString().split('T')[0];

        // Find all active recurring transactions that are due
        const dueTransactions = await db('recurring_transactions')
            .where('status', 'active')
            .where('next_date', '<=', today);

        let processedCount = 0;

        for (const rt of dueTransactions) {
            let nextDate = new Date(rt.next_date);

            while (nextDate.toISOString().split('T')[0] <= today) {
                const currentDateStr = nextDate.toISOString().split('T')[0];
                const actualAmount = rt.type === 'expense' ? -Math.abs(rt.amount) : Math.abs(rt.amount);

                await db('transactions').insert({
                    user_id: rt.user_id,
                    account_id: rt.account_id,
                    category_id: rt.category_id,
                    transfer_account_id: rt.transfer_account_id,
                    date: currentDateStr,
                    payee: rt.payee || (rt.is_subscription ? 'Subscription' : 'Recurring Transaction'),
                    memo: rt.memo || '',
                    amount: actualAmount,
                    cleared: false
                });

                await updateAccountBalance(rt.account_id, rt.user_id);

                if (rt.transfer_account_id) {
                    await db('transactions').insert({
                        user_id: rt.user_id,
                        account_id: rt.transfer_account_id,
                        date: currentDateStr,
                        payee: rt.payee || 'Transfer',
                        memo: rt.memo || '',
                        amount: -actualAmount,
                        transfer_account_id: rt.account_id,
                        cleared: false
                    });
                    await updateAccountBalance(rt.transfer_account_id, rt.user_id);
                }

                processedCount++;

                if (rt.frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
                else if (rt.frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
                else if (rt.frequency === 'biweekly') nextDate.setDate(nextDate.getDate() + 14);
                else if (rt.frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
                else if (rt.frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
                else break; // safety breakout
            }

            await db('recurring_transactions')
                .where({ id: rt.id })
                .update({
                    next_date: nextDate.toISOString().split('T')[0],
                    updated_at: new Date().toISOString()
                });
        }

        console.log(`Processed ${processedCount} recurring transactions.`);
        return processedCount;
    } catch (err) {
        console.error('Failed to process recurring transactions:', err);
    }
}

async function updateAccountBalance(accountId, userId) {
    const result = await db('transactions')
        .where({ account_id: accountId, user_id: userId })
        .sum('amount as total')
        .first();
    await db('accounts')
        .where({ id: accountId, user_id: userId })
        .update({ balance: result?.total || 0, updated_at: new Date().toISOString() });
}

/**
 * @param { import("knex").Knex } knex
 */
export async function seed(knex) {
    // Clear existing data
    await knex('budget_allocations').del();
    await knex('transactions').del();
    await knex('categories').del();
    await knex('category_groups').del();
    await knex('accounts').del();

    // Accounts
    const [checkingId] = await knex('accounts').insert([
        { name: 'Main Checking', type: 'checking', balance: 5000, sort_order: 1 }
    ]);
    const [savingsId] = await knex('accounts').insert([
        { name: 'Savings', type: 'savings', balance: 10000, sort_order: 2 }
    ]);
    const [creditId] = await knex('accounts').insert([
        { name: 'Credit Card', type: 'credit_card', balance: -450, sort_order: 3 }
    ]);

    // Category Groups & Categories
    const [fixedId] = await knex('category_groups').insert({ name: 'Fixed Expenses', sort_order: 1 });
    const [variableId] = await knex('category_groups').insert({ name: 'Variable Expenses', sort_order: 2 });
    const [savingsGrpId] = await knex('category_groups').insert({ name: 'Savings Goals', sort_order: 3 });
    const [funId] = await knex('category_groups').insert({ name: 'Fun Money', sort_order: 4 });

    const [rentCat] = await knex('categories').insert({ group_id: fixedId, name: 'Rent/Mortgage', sort_order: 1, goal_type: 'monthly_funding', goal_amount: 1200 });
    const [utilitiesCat] = await knex('categories').insert({ group_id: fixedId, name: 'Utilities', sort_order: 2, goal_type: 'monthly_funding', goal_amount: 150 });
    const [insuranceCat] = await knex('categories').insert({ group_id: fixedId, name: 'Insurance', sort_order: 3, goal_type: 'monthly_funding', goal_amount: 200 });
    const [phoneCat] = await knex('categories').insert({ group_id: fixedId, name: 'Phone', sort_order: 4, goal_type: 'monthly_funding', goal_amount: 60 });

    const [groceriesCat] = await knex('categories').insert({ group_id: variableId, name: 'Groceries', sort_order: 1, goal_type: 'monthly_funding', goal_amount: 400 });
    const [transportCat] = await knex('categories').insert({ group_id: variableId, name: 'Transport', sort_order: 2, goal_type: 'monthly_funding', goal_amount: 150 });
    const [healthCat] = await knex('categories').insert({ group_id: variableId, name: 'Health', sort_order: 3 });
    const [clothingCat] = await knex('categories').insert({ group_id: variableId, name: 'Clothing', sort_order: 4 });

    const [emergencyCat] = await knex('categories').insert({ group_id: savingsGrpId, name: 'Emergency Fund', sort_order: 1, goal_type: 'target_balance', goal_amount: 5000 });
    const [vacationCat] = await knex('categories').insert({ group_id: savingsGrpId, name: 'Vacation', sort_order: 2, goal_type: 'target_by_date', goal_amount: 2000, goal_target_date: '2026-06-01' });

    const [diningCat] = await knex('categories').insert({ group_id: funId, name: 'Dining Out', sort_order: 1, goal_type: 'monthly_funding', goal_amount: 200 });
    const [entertainCat] = await knex('categories').insert({ group_id: funId, name: 'Entertainment', sort_order: 2, goal_type: 'monthly_funding', goal_amount: 100 });
    const [hobbiesCat] = await knex('categories').insert({ group_id: funId, name: 'Hobbies', sort_order: 3 });

    // Budget Allocations (Jan & Feb 2026)
    const months = ['2026-01', '2026-02'];
    for (const month of months) {
        await knex('budget_allocations').insert([
            { category_id: rentCat, month, assigned: 1200 },
            { category_id: utilitiesCat, month, assigned: 150 },
            { category_id: insuranceCat, month, assigned: 200 },
            { category_id: phoneCat, month, assigned: 60 },
            { category_id: groceriesCat, month, assigned: 400 },
            { category_id: transportCat, month, assigned: 150 },
            { category_id: healthCat, month, assigned: 100 },
            { category_id: clothingCat, month, assigned: 75 },
            { category_id: emergencyCat, month, assigned: 200 },
            { category_id: vacationCat, month, assigned: 300 },
            { category_id: diningCat, month, assigned: 200 },
            { category_id: entertainCat, month, assigned: 100 },
            { category_id: hobbiesCat, month, assigned: 50 }
        ]);
    }

    // Transactions (Jan & Feb 2026)
    const txns = [
        // Jan income
        { account_id: checkingId, date: '2026-01-01', payee: 'Employer', amount: 4500, memo: 'Salary', cleared: true },
        // Jan expenses
        { account_id: checkingId, category_id: rentCat, date: '2026-01-02', payee: 'Landlord', amount: -1200, cleared: true },
        { account_id: checkingId, category_id: utilitiesCat, date: '2026-01-05', payee: 'Electric Co', amount: -95, cleared: true },
        { account_id: checkingId, category_id: utilitiesCat, date: '2026-01-05', payee: 'Water Dept', amount: -45, cleared: true },
        { account_id: checkingId, category_id: groceriesCat, date: '2026-01-07', payee: 'Whole Foods', amount: -120, cleared: true },
        { account_id: checkingId, category_id: groceriesCat, date: '2026-01-14', payee: 'Trader Joes', amount: -85, cleared: true },
        { account_id: checkingId, category_id: groceriesCat, date: '2026-01-21', payee: 'Costco', amount: -145, cleared: true },
        { account_id: checkingId, category_id: transportCat, date: '2026-01-10', payee: 'Gas Station', amount: -55, cleared: true },
        { account_id: checkingId, category_id: diningCat, date: '2026-01-08', payee: 'Pizza Place', amount: -35, cleared: true },
        { account_id: checkingId, category_id: diningCat, date: '2026-01-15', payee: 'Sushi Bar', amount: -65, cleared: true },
        { account_id: checkingId, category_id: entertainCat, date: '2026-01-12', payee: 'Netflix', amount: -15, cleared: true },
        { account_id: checkingId, category_id: entertainCat, date: '2026-01-20', payee: 'Movie Theater', amount: -30, cleared: true },
        { account_id: creditId, category_id: clothingCat, date: '2026-01-18', payee: 'Target', amount: -75, cleared: true },
        { account_id: checkingId, category_id: phoneCat, date: '2026-01-15', payee: 'T-Mobile', amount: -60, cleared: true },
        { account_id: checkingId, category_id: insuranceCat, date: '2026-01-01', payee: 'State Farm', amount: -180, cleared: true },
        // Feb income
        { account_id: checkingId, date: '2026-02-01', payee: 'Employer', amount: 4500, memo: 'Salary', cleared: true },
        // Feb expenses
        { account_id: checkingId, category_id: rentCat, date: '2026-02-02', payee: 'Landlord', amount: -1200, cleared: true },
        { account_id: checkingId, category_id: utilitiesCat, date: '2026-02-04', payee: 'Electric Co', amount: -110, cleared: true },
        { account_id: checkingId, category_id: groceriesCat, date: '2026-02-06', payee: 'Whole Foods', amount: -95, cleared: true },
        { account_id: checkingId, category_id: groceriesCat, date: '2026-02-13', payee: 'Trader Joes', amount: -110, cleared: true },
        { account_id: checkingId, category_id: transportCat, date: '2026-02-08', payee: 'Gas Station', amount: -60, cleared: true },
        { account_id: checkingId, category_id: diningCat, date: '2026-02-10', payee: 'Thai Restaurant', amount: -45, cleared: true },
        { account_id: creditId, category_id: entertainCat, date: '2026-02-14', payee: 'Concert Tickets', amount: -85, cleared: true },
        { account_id: checkingId, category_id: hobbiesCat, date: '2026-02-16', payee: 'Art Supplies', amount: -40, cleared: false },
        { account_id: checkingId, category_id: healthCat, date: '2026-02-18', payee: 'Pharmacy', amount: -25, cleared: false },
    ];

    await knex('transactions').insert(txns);
}

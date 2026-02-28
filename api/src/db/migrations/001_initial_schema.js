/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex.schema.createTable('accounts', (t) => {
        t.increments('id').primary();
        t.string('name').notNullable();
        t.string('type').notNullable(); // checking, savings, credit_card, cash, investment
        t.decimal('balance', 14, 2).notNullable().defaultTo(0);
        t.boolean('on_budget').notNullable().defaultTo(true);
        t.boolean('closed').notNullable().defaultTo(false);
        t.integer('sort_order').notNullable().defaultTo(0);
        t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('category_groups', (t) => {
        t.increments('id').primary();
        t.string('name').notNullable();
        t.integer('sort_order').notNullable().defaultTo(0);
        t.boolean('hidden').notNullable().defaultTo(false);
    });

    await knex.schema.createTable('categories', (t) => {
        t.increments('id').primary();
        t.integer('group_id').notNullable().references('id').inTable('category_groups').onDelete('CASCADE');
        t.string('name').notNullable();
        t.integer('sort_order').notNullable().defaultTo(0);
        t.string('goal_type'); // target_balance, monthly_funding, target_by_date
        t.decimal('goal_amount', 14, 2);
        t.string('goal_target_date');
        t.boolean('hidden').notNullable().defaultTo(false);
    });

    await knex.schema.createTable('transactions', (t) => {
        t.increments('id').primary();
        t.integer('account_id').notNullable().references('id').inTable('accounts').onDelete('CASCADE');
        t.integer('category_id').references('id').inTable('categories').onDelete('SET NULL');
        t.string('date').notNullable();
        t.string('payee');
        t.string('memo');
        t.decimal('amount', 14, 2).notNullable();
        t.integer('transfer_account_id').references('id').inTable('accounts');
        t.boolean('cleared').notNullable().defaultTo(false);
        t.boolean('reconciled').notNullable().defaultTo(false);
        t.boolean('is_recurring').notNullable().defaultTo(false);
        t.text('recurring_rule'); // JSON string
        t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('budget_allocations', (t) => {
        t.increments('id').primary();
        t.integer('category_id').notNullable().references('id').inTable('categories').onDelete('CASCADE');
        t.string('month').notNullable(); // YYYY-MM
        t.decimal('assigned', 14, 2).notNullable().defaultTo(0);
        t.unique(['category_id', 'month']);
    });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    await knex.schema.dropTableIfExists('budget_allocations');
    await knex.schema.dropTableIfExists('transactions');
    await knex.schema.dropTableIfExists('categories');
    await knex.schema.dropTableIfExists('category_groups');
    await knex.schema.dropTableIfExists('accounts');
}

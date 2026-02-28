export async function up(knex) {
    return knex.schema.createTable('recurring_transactions', table => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE').notNullable();
        table.integer('account_id').unsigned().references('id').inTable('accounts').onDelete('CASCADE').notNullable();
        table.integer('category_id').unsigned().references('id').inTable('categories').onDelete('SET NULL');
        table.integer('transfer_account_id').unsigned().references('id').inTable('accounts').onDelete('CASCADE');

        table.string('type').notNullable(); // 'income', 'expense', 'transfer'
        table.decimal('amount', 14, 2).notNullable();
        table.string('payee');
        table.string('memo');
        table.string('frequency').notNullable(); // 'daily', 'weekly', 'biweekly', 'monthly', 'yearly'
        table.date('next_date').notNullable();

        // Fields specific to subscriptions
        table.boolean('is_subscription').defaultTo(false);
        table.string('subscription_url');
        table.string('status').defaultTo('active'); // active, paused, cancelled

        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
}

export async function down(knex) {
    return knex.schema.dropTableIfExists('recurring_transactions');
}

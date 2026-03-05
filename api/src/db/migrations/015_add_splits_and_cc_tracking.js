export function up(knex) {
    return knex.schema
        // Split transactions table
        .createTable('transaction_splits', table => {
            table.increments('id').primary();
            table.integer('transaction_id').unsigned().notNullable()
                .references('id').inTable('transactions').onDelete('CASCADE');
            table.integer('category_id').unsigned()
                .references('id').inTable('categories').onDelete('SET NULL');
            table.decimal('amount', 14, 2).notNullable();
            table.string('memo');
            table.string('payee');
            table.integer('sort_order').notNullable().defaultTo(0);
        })
        // Split templates
        .createTable('split_templates', table => {
            table.increments('id').primary();
            table.integer('user_id').unsigned().notNullable()
                .references('id').inTable('users').onDelete('CASCADE');
            table.string('name').notNullable();
            table.decimal('total_amount', 14, 2);
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        })
        .createTable('split_template_lines', table => {
            table.increments('id').primary();
            table.integer('template_id').unsigned().notNullable()
                .references('id').inTable('split_templates').onDelete('CASCADE');
            table.integer('category_id').unsigned()
                .references('id').inTable('categories').onDelete('SET NULL');
            table.decimal('amount', 14, 2);
            table.decimal('percentage', 5, 2);
            table.string('payee');
            table.string('memo');
            table.integer('sort_order').notNullable().defaultTo(0);
        })
        // CC payment tracking link table
        .createTable('cc_payment_categories', table => {
            table.integer('account_id').unsigned().notNullable()
                .references('id').inTable('accounts').onDelete('CASCADE');
            table.integer('category_id').unsigned().notNullable()
                .references('id').inTable('categories').onDelete('CASCADE');
            table.unique(['account_id']);
        })
        // Add columns to transactions
        .alterTable('transactions', table => {
            table.boolean('is_split').notNullable().defaultTo(false);
        })
        // Add CC tracking + statement balance to accounts
        .alterTable('accounts', table => {
            table.boolean('is_credit_card_tracking').notNullable().defaultTo(false);
            table.decimal('statement_balance', 14, 2);
        });
}

export function down(knex) {
    return knex.schema
        .alterTable('accounts', table => {
            table.dropColumn('is_credit_card_tracking');
            table.dropColumn('statement_balance');
        })
        .alterTable('transactions', table => {
            table.dropColumn('is_split');
        })
        .dropTableIfExists('cc_payment_categories')
        .dropTableIfExists('split_template_lines')
        .dropTableIfExists('split_templates')
        .dropTableIfExists('transaction_splits');
}

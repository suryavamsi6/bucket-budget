export function up(knex) {
    return knex.schema
        .createTable('category_predictions', table => {
            table.increments('id').primary();
            table.integer('user_id').unsigned().notNullable()
                .references('id').inTable('users').onDelete('CASCADE');
            table.string('payee_pattern').notNullable();
            table.integer('category_id').unsigned()
                .references('id').inTable('categories').onDelete('SET NULL');
            table.decimal('confidence', 3, 2).notNullable().defaultTo(0.5);
            table.integer('training_count').notNullable().defaultTo(1);
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
            table.unique(['user_id', 'payee_pattern', 'category_id']);
        })
        .createTable('categorization_feedback', table => {
            table.increments('id').primary();
            table.integer('user_id').unsigned().notNullable()
                .references('id').inTable('users').onDelete('CASCADE');
            table.integer('transaction_id').unsigned()
                .references('id').inTable('transactions').onDelete('SET NULL');
            table.integer('suggested_category_id').unsigned()
                .references('id').inTable('categories').onDelete('SET NULL');
            table.integer('chosen_category_id').unsigned()
                .references('id').inTable('categories').onDelete('SET NULL');
            table.string('payee');
            table.decimal('amount', 14, 2);
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
        })
        // Add auto_created and new match fields to transaction_rules
        .alterTable('transaction_rules', table => {
            table.boolean('auto_created').notNullable().defaultTo(false);
            table.string('set_memo');
            table.string('set_tags');
        });
}

export function down(knex) {
    return knex.schema
        .alterTable('transaction_rules', table => {
            table.dropColumn('auto_created');
            table.dropColumn('set_memo');
            table.dropColumn('set_tags');
        })
        .dropTableIfExists('categorization_feedback')
        .dropTableIfExists('category_predictions');
}

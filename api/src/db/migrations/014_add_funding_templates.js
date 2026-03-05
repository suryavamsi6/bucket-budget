export function up(knex) {
    return knex.schema
        .createTable('funding_templates', table => {
            table.increments('id').primary();
            table.integer('user_id').unsigned().notNullable()
                .references('id').inTable('users').onDelete('CASCADE');
            table.string('name').notNullable();
            table.string('trigger_type').notNullable().defaultTo('manual'); // manual, on_income, scheduled
            table.integer('trigger_recurring_id').unsigned()
                .references('id').inTable('recurring_transactions').onDelete('SET NULL');
            table.string('schedule_frequency'); // daily, weekly, biweekly, monthly, yearly
            table.date('schedule_next_date');
            table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
            table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
        })
        .createTable('funding_template_lines', table => {
            table.increments('id').primary();
            table.integer('template_id').unsigned().notNullable()
                .references('id').inTable('funding_templates').onDelete('CASCADE');
            table.integer('category_id').unsigned()
                .references('id').inTable('categories').onDelete('SET NULL');
            table.decimal('amount', 14, 2).notNullable().defaultTo(0);
            table.string('type').notNullable().defaultTo('fixed'); // fixed, percentage, remainder
            table.integer('sort_order').notNullable().defaultTo(0);
        });
}

export function down(knex) {
    return knex.schema
        .dropTableIfExists('funding_template_lines')
        .dropTableIfExists('funding_templates');
}

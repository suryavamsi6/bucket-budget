export async function up(knex) {
    // Add icon column to categories
    await knex.schema.alterTable('categories', table => {
        table.string('icon').defaultTo('');
    });

    // Add tags column to transactions
    await knex.schema.alterTable('transactions', table => {
        table.string('tags').defaultTo('');
    });

    // Create goals table
    await knex.schema.createTable('goals', table => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE').notNullable();
        table.string('name').notNullable();
        table.string('icon').defaultTo('🎯');
        table.decimal('target_amount', 14, 2).notNullable();
        table.decimal('saved_amount', 14, 2).notNullable().defaultTo(0);
        table.string('target_date'); // YYYY-MM-DD
        table.string('color').defaultTo('#6366f1'); // indigo
        table.integer('category_id').references('id').inTable('categories').onDelete('SET NULL');
        table.string('status').defaultTo('active'); // active, completed, paused
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    // Create debts table
    await knex.schema.createTable('debts', table => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE').notNullable();
        table.string('name').notNullable();
        table.string('type').defaultTo('credit_card'); // credit_card, student_loan, mortgage, car_loan, personal_loan, other
        table.decimal('balance', 14, 2).notNullable();
        table.decimal('interest_rate', 5, 2).notNullable().defaultTo(0);
        table.decimal('minimum_payment', 14, 2).notNullable().defaultTo(0);
        table.decimal('extra_payment', 14, 2).defaultTo(0);
        table.string('due_day').defaultTo('1');
        table.string('color').defaultTo('#ef4444');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });

    // Create csv_mappings table for bank CSV auto-mapping
    await knex.schema.createTable('csv_mappings', table => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE').notNullable();
        table.string('bank_name').notNullable();
        table.text('column_map').notNullable(); // JSON string
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.unique(['user_id', 'bank_name']);
    });
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('csv_mappings');
    await knex.schema.dropTableIfExists('debts');
    await knex.schema.dropTableIfExists('goals');
    await knex.schema.alterTable('transactions', table => {
        table.dropColumn('tags');
    });
    await knex.schema.alterTable('categories', table => {
        table.dropColumn('icon');
    });
}

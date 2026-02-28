export async function up(knex) {
    // Add SIP config columns to investments table
    await knex.schema.alterTable('investments', table => {
        table.boolean('sip_enabled').notNullable().defaultTo(false);
        table.decimal('sip_amount', 14, 2).defaultTo(0);
        table.string('sip_frequency').defaultTo('monthly'); // monthly, weekly, biweekly
        table.integer('sip_day').defaultTo(1); // day of month (1-28)
    });

    // Create investment_transactions table for buy/sell history
    return knex.schema.createTable('investment_transactions', table => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE').notNullable();
        table.integer('investment_id').unsigned().references('id').inTable('investments').onDelete('CASCADE').notNullable();

        table.string('type').notNullable().defaultTo('buy'); // buy, sell, sip
        table.decimal('quantity', 20, 8).notNullable().defaultTo(0);
        table.decimal('price', 14, 2).notNullable().defaultTo(0);
        table.date('date').notNullable();
        table.string('notes');

        table.timestamp('created_at').defaultTo(knex.fn.now());
    });
}

export async function down(knex) {
    await knex.schema.dropTableIfExists('investment_transactions');
    return knex.schema.alterTable('investments', table => {
        table.dropColumn('sip_enabled');
        table.dropColumn('sip_amount');
        table.dropColumn('sip_frequency');
        table.dropColumn('sip_day');
    });
}

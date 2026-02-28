export async function up(knex) {
    return knex.schema.createTable('investments', table => {
        table.increments('id').primary();
        table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE').notNullable();

        table.string('ticker').notNullable(); // AAPL, BTC, etc
        table.string('name').notNullable(); // Apple Inc, Bitcoin
        table.string('asset_class').notNullable().defaultTo('Stock'); // Stock, Crypto, Bond, ETF, Real Estate
        table.decimal('quantity', 20, 8).notNullable().defaultTo(0);
        table.decimal('average_price', 14, 2).notNullable().defaultTo(0);
        table.decimal('current_price', 14, 2);

        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
}

export async function down(knex) {
    return knex.schema.dropTableIfExists('investments');
}

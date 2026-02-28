/**
 * @param { import("knex").Knex } knex
 */
export async function up(knex) {
    // Settings table for app configuration (currency, theme, etc.)
    await knex.schema.createTable('settings', (t) => {
        t.string('key').primary();
        t.text('value').notNullable();
    });

    // Insert default settings
    await knex('settings').insert([
        { key: 'currency', value: 'USD' },
        { key: 'locale', value: 'en-US' },
        { key: 'theme', value: 'dark' },
        { key: 'currency_symbol', value: '$' }
    ]);
}

/**
 * @param { import("knex").Knex } knex
 */
export async function down(knex) {
    await knex.schema.dropTableIfExists('settings');
}

export async function up(knex) {
    return knex.schema
        .createTable('users', table => {
            table.increments('id').primary();
            table.string('name').notNullable();
            table.string('email').notNullable().unique();
            table.string('password_hash').notNullable();
            table.timestamps(true, true);
        })
        .alterTable('accounts', table => {
            table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
        })
        .alterTable('category_groups', table => {
            table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
        })
        .alterTable('categories', table => {
            table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
        })
        .alterTable('transactions', table => {
            table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
        })
        .alterTable('budget_allocations', table => {
            table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
        })
        .alterTable('settings', table => {
            table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
        });
}

export async function down(knex) {
    return knex.schema
        .alterTable('settings', table => {
            table.dropColumn('user_id');
        })
        .alterTable('budget_allocations', table => {
            table.dropColumn('user_id');
        })
        .alterTable('transactions', table => {
            table.dropColumn('user_id');
        })
        .alterTable('categories', table => {
            table.dropColumn('user_id');
        })
        .alterTable('category_groups', table => {
            table.dropColumn('user_id');
        })
        .alterTable('accounts', table => {
            table.dropColumn('user_id');
        })
        .dropTable('users');
}

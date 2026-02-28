export default {
    client: 'sqlite3',
    connection: {
        filename: process.env.DB_PATH || './data/budget.db'
    },
    useNullAsDefault: true,
    migrations: {
        directory: './src/db/migrations'
    },
    seeds: {
        directory: './src/db/seeds'
    }
};

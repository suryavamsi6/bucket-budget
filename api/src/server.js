import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fastifyMultipart from '@fastify/multipart';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execSync } from 'child_process';
import db from './db/knex.js';
import accountRoutes from './routes/accounts.js';
import categoryRoutes from './routes/categories.js';
import transactionRoutes from './routes/transactions.js';
import budgetRoutes from './routes/budgets.js';
import reportRoutes from './routes/reports.js';
import metricsRoutes from './routes/metrics.js';
import settingsRoutes from './routes/settings.js';
import authRoutes from './routes/auth.js';
import subscriptionRoutes from './routes/subscriptions.js';
import investmentRoutes from './routes/investments.js';
import goalRoutes from './routes/goals.js';
import debtRoutes from './routes/debts.js';
import insightRoutes from './routes/insights.js';
import exportRoutes from './routes/export.js';
import aiRoutes from './routes/ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = Fastify({
    logger: true,
    connectionTimeout: 300000,   // 5 min — needed for LLM chat requests
    requestTimeout: 300000
});

await app.register(cors, { origin: true });
await app.register(fastifyMultipart, { limits: { fileSize: 10 * 1024 * 1024 } });

// API routes
app.register(authRoutes, { prefix: '/api/auth' });
app.register(accountRoutes, { prefix: '/api/accounts' });
app.register(categoryRoutes, { prefix: '/api' });
app.register(transactionRoutes, { prefix: '/api/transactions' });
app.register(budgetRoutes, { prefix: '/api/budget' });
app.register(reportRoutes, { prefix: '/api/reports' });
app.register(metricsRoutes);
app.register(settingsRoutes, { prefix: '/api/settings' });
app.register(subscriptionRoutes, { prefix: '/api/subscriptions' });
app.register(investmentRoutes, { prefix: '/api/investments' });
app.register(goalRoutes, { prefix: '/api/goals' });
app.register(debtRoutes, { prefix: '/api/debts' });
app.register(insightRoutes, { prefix: '/api/insights' });
app.register(exportRoutes, { prefix: '/api/export' });
app.register(aiRoutes, { prefix: '/api/ai' });

// Serve static frontend in production
const uiDistPath = join(__dirname, '../../ui/dist');
try {
    await app.register(fastifyStatic, {
        root: uiDistPath,
        prefix: '/',
        wildcard: false
    });
    // SPA fallback
    app.setNotFoundHandler(async (request, reply) => {
        if (request.url.startsWith('/api/') || request.url === '/metrics') {
            return reply.code(404).send({ error: 'Not found' });
        }
        return reply.sendFile('index.html');
    });
} catch {
    app.log.info('No UI dist found, running API-only mode');
}

// Run migrations on startup
async function start() {
    try {
        const host = process.env.HOST || '0.0.0.0';
        const port = parseInt(process.env.PORT || '3000', 10);
        await app.listen({ port, host });
        app.log.info(`Bucket Budget running on http://${host}:${port}`);
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

start();

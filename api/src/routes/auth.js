import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/knex.js';
import authenticate from '../middleware/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-prod';

export default async function authRoutes(fastify) {
    // Register User
    fastify.post('/register', async (request, reply) => {
        try {
            const { name, username, email, password } = request.body;

            if (!name || !username || !email || !password) {
                return reply.code(400).send({ error: 'Name, username, email, and password are required' });
            }

            // Check if user already exists
            const existingUser = await db('users').where({ email }).orWhere({ username }).first();
            if (existingUser) {
                return reply.code(400).send({ error: 'User with this email or username already exists' });
            }

            // Hash password
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);

            // Insert user
            const [userId] = await db('users').insert({
                name,
                username,
                email,
                password_hash
            });

            // Initialize default settings for the user
            await db('settings').insert([
                { user_id: userId, key: 'currency', value: 'USD' },
                { user_id: userId, key: 'locale', value: 'en-US' },
                { user_id: userId, key: 'currency_symbol', value: '$' },
                { user_id: userId, key: 'theme', value: 'dark' }
            ]);

            // Generate token
            const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });

            return reply.code(201).send({
                token,
                user: { id: userId, name, username, email }
            });
        } catch (err) {
            request.log.error(err);
            return reply.code(500).send({ error: 'Failed to register user' });
        }
    });

    fastify.post('/login', async (request, reply) => {
        try {
            // Frontend might send the identifier as 'email' or 'username'
            const identifier = request.body.email || request.body.username;
            const password = request.body.password;

            if (!identifier || !password) {
                return reply.code(400).send({ error: 'Username/Email and password are required' });
            }

            // Find user
            const user = await db('users').where('email', identifier).orWhere('username', identifier).first();
            if (!user) {
                return reply.code(401).send({ error: 'Invalid credentials' });
            }

            // Check password
            const validPassword = await bcrypt.compare(password, user.password_hash);
            if (!validPassword) {
                return reply.code(401).send({ error: 'Invalid email or password' });
            }

            // Generate token
            const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

            return {
                token,
                user: { id: user.id, name: user.name, username: user.username, email: user.email }
            };
        } catch (err) {
            request.log.error(err);
            return reply.code(500).send({ error: 'Failed to log in' });
        }
    });

    // Get Current User (Me)
    fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
        try {
            const user = await db('users').where({ id: request.user.id }).first();
            if (!user) {
                return reply.code(404).send({ error: 'User not found' });
            }

            return { user: { id: user.id, name: user.name, username: user.username, email: user.email } };
        } catch (err) {
            request.log.error(err);
            return reply.code(500).send({ error: 'Failed to get user profile' });
        }
    });
}

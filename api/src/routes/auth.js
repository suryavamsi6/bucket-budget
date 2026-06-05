import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/knex.js';
import authenticate from '../middleware/auth.js';
import { getJwtSecret } from '../config/auth.js';

const JWT_SECRET = getJwtSecret();

// Dummy hash for constant-time comparison during login
const DUMMY_HASH = bcrypt.hashSync('dummy', 10);

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

            const userId = await db.transaction(async (trx) => {
                const [newUserId] = await trx('users').insert({
                    name,
                    username,
                    email,
                    password_hash
                });

                await trx('settings').insert([
                    { user_id: newUserId, key: 'currency', value: 'USD' },
                    { user_id: newUserId, key: 'locale', value: 'en-US' },
                    { user_id: newUserId, key: 'currency_symbol', value: '$' },
                    { user_id: newUserId, key: 'theme', value: 'dark' }
                ]);

                const defaultGroups = [
                    { name: 'Housing', categories: [{ name: 'Rent/Mortgage' }, { name: 'Home Maintenance' }, { name: 'Property Taxes' }] },
                    { name: 'Utilities', categories: [{ name: 'Electricity' }, { name: 'Water' }, { name: 'Internet' }, { name: 'Trash' }, { name: 'Cell Phone' }] },
                    { name: 'Food', categories: [{ name: 'Groceries' }, { name: 'Dining Out' }] },
                    { name: 'Transportation', categories: [{ name: 'Auto Loan' }, { name: 'Gas' }, { name: 'Auto Maintenance' }, { name: 'Auto Insurance' }, { name: 'Public Transit' }] },
                    { name: 'Personal', categories: [{ name: 'Clothing' }, { name: 'Entertainment' }, { name: 'Subscriptions' }, { name: 'Hobbies' }] },
                    { name: 'Health & Fitness', categories: [{ name: 'Medical/Dental' }, { name: 'Gym/Sports' }, { name: 'Pharmacy' }] },
                    { name: 'Savings & Debt', categories: [{ name: 'Emergency Fund' }, { name: 'Retirement' }, { name: 'Extra Debt Payment' }] }
                ];

                let groupSortOrder = 1;
                for (const group of defaultGroups) {
                    const [groupId] = await trx('category_groups').insert({
                        user_id: newUserId,
                        name: group.name,
                        sort_order: groupSortOrder++
                    });

                    let categorySortOrder = 1;
                    const categoryInserts = group.categories.map(cat => ({
                        user_id: newUserId,
                        group_id: groupId,
                        name: cat.name,
                        sort_order: categorySortOrder++
                    }));

                    await trx('categories').insert(categoryInserts);
                }

                return newUserId;
            });

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
                // Prevent user enumeration timing attack by performing a dummy hash comparison
                await bcrypt.compare(password, DUMMY_HASH);
                return reply.code(401).send({ error: 'Invalid email or password' });
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

    // Forgot Password
    fastify.post('/forgot-password', async (request, reply) => {
        try {
            const { email } = request.body;
            if (!email) return reply.code(400).send({ error: 'Email is required' });

            const user = await db('users').where({ email }).first();
            if (!user) {
                // For security, do not reveal if the email exists or not
                return reply.send({ message: 'If the email exists, a reset link has been sent.' });
            }

            // Generate a secure reset token
            const crypto = await import('crypto');
            const resetToken = crypto.randomBytes(32).toString('hex');

            // Invalidate any existing unused reset tokens for this user
            await db('password_resets').where({ user_id: user.id, used: false }).update({ used: true });

            // Set expiration to 1 hour from now
            const expiresAt = new Date(Date.now() + 3600000);

            await db('password_resets').insert({
                user_id: user.id,
                token: resetToken,
                expires_at: expiresAt,
                used: false
            });

            // MOCK EMAIL SERVICE 
            // In a real app, integrate SendGrid/AWS SES here
            const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
            const resetUrl = `${appBaseUrl.replace(/\/$/, '')}/reset-password?token=${resetToken}`;
            request.log.info(`\n\n=== PASSWORD RESET EMAIL ===\nTo: ${user.email}\nLink: ${resetUrl}\n============================\n`);

            return reply.send({ message: 'If the email exists, a reset link has been sent.' });
        } catch (err) {
            request.log.error(err);
            return reply.code(500).send({ error: 'Failed to process forgot password request' });
        }
    });

    // Reset Password
    fastify.post('/reset-password', async (request, reply) => {
        try {
            const { token, password } = request.body;

            if (!token || !password) {
                return reply.code(400).send({ error: 'Token and new password are required' });
            }

            // Find valid, unused token
            const resetRecord = await db('password_resets')
                .where({ token, used: false })
                .andWhere('expires_at', '>', new Date())
                .first();

            if (!resetRecord) {
                return reply.code(400).send({ error: 'Invalid or expired reset token' });
            }

            // Hash the new password
            const salt = await bcrypt.genSalt(10);
            const password_hash = await bcrypt.hash(password, salt);

            // Update user's password
            await db('users').where({ id: resetRecord.user_id }).update({ password_hash });

            // Mark token as used
            await db('password_resets').where({ id: resetRecord.id }).update({ used: true });

            return reply.send({ message: 'Password has been successfully updated' });
        } catch (err) {
            request.log.error(err);
            return reply.code(500).send({ error: 'Failed to reset password' });
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

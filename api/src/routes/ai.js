import db from '../db/knex.js';
import authenticate from '../middleware/auth.js';
import { buildFinancialContext } from './export.js';

export default async function aiRoutes(fastify) {
    fastify.addHook('preHandler', authenticate);

    // List available models from provider
    fastify.get('/models', async (request, reply) => {
        const { provider = 'ollama', base_url } = request.query;

        const baseUrl = base_url || (provider === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234');

        try {
            if (provider === 'ollama') {
                const resp = await fetch(`${baseUrl}/api/tags`);
                if (!resp.ok) throw new Error(`Ollama returned ${resp.status}`);
                const data = await resp.json();
                return { models: (data.models || []).map(m => ({ id: m.name, name: m.name, size: m.size })) };
            } else {
                // LM Studio uses OpenAI-compatible API
                const resp = await fetch(`${baseUrl}/v1/models`);
                if (!resp.ok) throw new Error(`LM Studio returned ${resp.status}`);
                const data = await resp.json();
                return { models: (data.data || []).map(m => ({ id: m.id, name: m.id })) };
            }
        } catch (error) {
            return reply.code(502).send({
                error: `Cannot connect to ${provider} at ${baseUrl}`,
                details: error.message,
                hint: provider === 'ollama'
                    ? 'Make sure Ollama is running: ollama serve'
                    : 'Make sure LM Studio server is running with the API enabled'
            });
        }
    });

    // Chat with LLM — auto-attaches financial context
    fastify.post('/chat', { config: { requestTimeout: 300000 } }, async (request, reply) => {
        // Increase Fastify reply timeout for LLM requests (5 min)
        request.raw.setTimeout(300000);
        reply.raw.setTimeout(300000);

        const userId = request.user.id;
        const { messages, provider = 'ollama', base_url, model, include_context = true } = request.body;

        const baseUrl = base_url || (provider === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234');

        if (!messages || !messages.length) {
            return reply.code(400).send({ error: 'messages array is required' });
        }

        if (!model) {
            return reply.code(400).send({ error: 'model is required' });
        }

        // Build system prompt with financial context
        let systemPrompt = `You are a helpful personal finance advisor. Your name is Finny. You analyze the user's financial data and provide actionable, specific advice. Be concise and practical. Use the currency shown in the data. Format your responses with bullet points and bold text for key numbers.`;

        if (include_context) {
            try {
                const financialData = await buildFinancialContext(userId, 'all', 3);
                systemPrompt += `\n\nHere is the user's current financial data:\n\n${financialData}`;
            } catch (e) {
                // Continue without context if it fails
                systemPrompt += '\n\n(Financial data could not be loaded)';
            }
        }

        // Build the messages array with system prompt
        const fullMessages = [
            { role: 'system', content: systemPrompt },
            ...messages
        ];

        // 5-minute timeout for LLM responses (large models can be slow)
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 300000);

        try {
            let responseText = '';

            if (provider === 'ollama') {
                // Ollama API
                const resp = await fetch(`${baseUrl}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model,
                        messages: fullMessages,
                        stream: false
                    }),
                    signal: controller.signal
                });

                if (!resp.ok) {
                    const err = await resp.text();
                    throw new Error(`Ollama error: ${err}`);
                }

                const data = await resp.json();
                responseText = data.message?.content || '';
            } else {
                // LM Studio (OpenAI-compatible)
                const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model,
                        messages: fullMessages,
                        temperature: 0.7,
                        max_tokens: 2048
                    }),
                    signal: controller.signal
                });

                if (!resp.ok) {
                    const err = await resp.text();
                    throw new Error(`LM Studio error: ${err}`);
                }

                const data = await resp.json();
                responseText = data.choices?.[0]?.message?.content || '';
            }

            clearTimeout(timeout);

            return {
                role: 'assistant',
                content: responseText,
                model,
                provider
            };
        } catch (error) {
            clearTimeout(timeout);
            const isTimeout = error.name === 'AbortError';
            return reply.code(502).send({
                error: isTimeout
                    ? `Request to ${provider} timed out after 5 minutes`
                    : `Failed to get response from ${provider}`,
                details: error.message,
                hint: provider === 'ollama'
                    ? 'Ensure the model is downloaded: ollama pull ' + model
                    : 'Ensure the model is loaded in LM Studio'
            });
        }
    });
}

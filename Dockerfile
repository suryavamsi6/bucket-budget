# Build UI
FROM node:20-alpine AS ui-build
WORKDIR /app/ui
COPY ui/package*.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

# Build API
FROM node:20-alpine AS api-build
WORKDIR /app/api
COPY api/package*.json ./
RUN npm ci --omit=dev
COPY api/ ./

# Production
FROM node:20-alpine
WORKDIR /app

# Copy API
COPY --from=api-build /app/api ./api

# Copy built UI into api serving path
COPY --from=ui-build /app/ui/dist ./ui/dist

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DB_PATH=/app/data/budget.db
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

WORKDIR /app/api
CMD ["node", "src/server.js"]

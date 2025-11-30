FROM node:22-alpine

WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --only=production

# Copy built files
COPY dist/ ./dist/

# Non-root user for security
RUN adduser -D -u 1000 engine
USER engine

CMD ["node", "dist/index.js"]

FROM node:25-trixie

WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --only=production

# Copy built files
COPY dist/ ./dist/

# Use existing node user (UID 1000) for security
USER node

CMD ["node", "dist/index.js"]

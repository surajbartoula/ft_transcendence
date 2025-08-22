FROM node:24-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN apk add --no-cache build-base python3 curl && \
    npm ci

# Copy source code and build files
COPY . .

# Build the frontend
RUN npm run build

# Remove dev dependencies after build
RUN npm ci --omit=dev && \
    apk del build-base python3

# Create SSL certificate directory with proper permissions
RUN mkdir -p /app/ssl && \
    chown -R 1001:1001 /app/ssl

# Create non-root user
RUN addgroup -g 1001 -S nodejs \
	&& adduser -S nodeuser -u 1001 \
	&& chown -R nodeuser:nodejs /app

USER nodeuser

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "src/server.js"]
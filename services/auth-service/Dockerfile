FROM node:24-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN apk add --no-cache build-base python3 curl && \
    npm ci --omit=dev && \
    apk del build-base python3

# Copy source code
COPY src/ ./src/

# Create non-root user
RUN addgroup -g 1001 -S nodejs \
	&& adduser -S nodeuser -u 1001 \
	&& chown -R nodeuser:nodejs /app

USER nodeuser

# Set environment variable to indicate Docker environment
ENV DOCKER_ENV=true

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "\
    const http = require('http'); \
    const req = http.request('http://localhost:3001/health', res => { \
      process.exit(res.statusCode === 200 ? 0 : 1); \
    }); \
    req.on('error', () => process.exit(1)); \
    req.end();"

# Start the application
CMD ["node", "src/server.js"]
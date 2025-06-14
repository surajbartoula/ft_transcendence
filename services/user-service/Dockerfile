FROM node:24-alpine

# Set working directory
WORKDIR /app

# Create data directory for SQLite
RUN mkdir -p /app/data

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeuser -u 1001

# Change ownership of the app directory
RUN chown -R nodeuser:nodejs /app
USER nodeuser

# Expose port
EXPOSE 3002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e " \
    	const http = require('http'); \
		const req = http.request('http://localhost:3002/health', res => { \
        	process.exit(res.statusCode === 200 ? 0 : 1); \
      }); \
      req.on('error', () => process.exit(1)); \
      req.end(); \
    }); \
  "

# Start the application
CMD ["node", "src/main.js"]
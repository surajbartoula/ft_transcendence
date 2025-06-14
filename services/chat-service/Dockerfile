FROM node:24-alpine

# Create app directory
WORKDIR /usr/src/app

# Create data directory for SQLite
RUN mkdir -p data

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S chatservice -u 1001

# Change ownership of the app directory
RUN chown -R chatservice:nodejs /usr/src/app
USER chatservice

# Expose port
EXPOSE 3003

# Health check using CommonJS require
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "\
    const http = require('http'); \
    const options = { hostname: 'localhost', port: 3003, path: '/health', method: 'GET' }; \
    const req = http.request(options, (res) => { \
      if (res.statusCode === 200) process.exit(0); \
      else process.exit(1); \
    }); \
    req.on('error', () => process.exit(1)); \
    req.end(); \
  "

# Start the application
CMD ["npm", "start"]

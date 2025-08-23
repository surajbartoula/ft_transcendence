FROM node:24-alpine

# Set working directory
WORKDIR /app

# Install system dependencies first
RUN apk add --no-cache build-base python3 curl

# Create non-root user early
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 -G nodejs

# Copy package files
COPY package*.json ./

# Install dependencies (keep dev dependencies if you need to build)
RUN npm ci

# Copy source code
COPY src/ ./src/

# Create SSL certificate directory
RUN mkdir -p /app/ssl

# Fix ownership of all files at once
RUN chown -R nodeuser:nodejs /app

# Clean up build dependencies and remove dev dependencies
RUN npm ci --omit=dev && \
    apk del build-base python3

# Switch to non-root user
USER nodeuser

# Set environment variable
ENV DOCKER_ENV=true

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "src/server.js"]
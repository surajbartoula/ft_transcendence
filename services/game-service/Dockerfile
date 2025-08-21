FROM node:24-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Create SSL certificate directory with proper permissions
RUN mkdir -p /app/ssl && \
    chown -R 1001:1001 /app/ssl

# Install dependencies
RUN apk add --no-cache build-base python3 && \
    npm ci --omit=dev && \
    apk del build-base python3

#Install sqlite
RUN apk update && apk add --no-cache sqlite

# Copy source code
COPY src/ ./src/

# Set environment variable to indicate Docker environment
ENV DOCKER_ENV=true

# Create non-root user
RUN addgroup -g 1001 -S nodejs \
	&& adduser -S nodeuser -u 1001 \
	&& chown -R nodeuser:nodejs /app

USER nodeuser

# Expose port
EXPOSE 3004

# Start the application
CMD ["node", "src/server.js"]
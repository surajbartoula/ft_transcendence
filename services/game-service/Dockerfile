FROM node:24-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN apk add --no-cache build-base python3 && \
    npm ci --omit=dev && \
    apk del build-base python3

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
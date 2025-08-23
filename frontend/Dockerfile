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

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code and build files
COPY . .

# Build the frontend
RUN npm run build

# Remove dev dependencies after build
RUN npm ci --omit=dev && \
    apk del build-base python3

# Create SSL certificate directory and fix permissions
RUN mkdir -p /app/ssl

# Change ownership all files
RUN chown -R nodeuser:nodejs /app

# Switch to non-root user
USER nodeuser

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "src/server.js"]
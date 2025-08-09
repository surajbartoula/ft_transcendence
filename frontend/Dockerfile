# Build stage
FROM node:24-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
# copy everything from current directory on the host into /app inside the container
COPY . .
RUN npm run build

# Production stage
FROM nginx:stable-alpine

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

# Create SSL directory
RUN mkdir -p /etc/nginx/ssl

# Create HTTPS nginx config
RUN echo 'server { \
    listen 3000 ssl; \
    server_name localhost; \
    \
    # SSL Configuration \
    ssl_certificate /etc/nginx/ssl/cert.pem; \
    ssl_certificate_key /etc/nginx/ssl/key.pem; \
    \
    # SSL Security Settings \
    ssl_protocols TLSv1.2 TLSv1.3; \
    ssl_ciphers HIGH:!aNULL:!MD5; \
    ssl_prefer_server_ciphers on; \
    \
    # Document root \
    root /usr/share/nginx/html; \
    index index.html index.htm; \
    \
    # SPA routing \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    # Error page \
    error_page 404 /index.html; \
    \
    # Static assets caching \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
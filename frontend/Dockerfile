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
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD [ "nginx", "-g", "daemon off;"]

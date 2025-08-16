# Multi-stage build for jq-web application

# Build stage
FROM node:18-alpine AS builder

# Install build dependencies (make is needed for the test script)
RUN apk add --no-cache make

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Run tests (optional - remove if tests are not required for build)
#RUN npm test

# Production stage
FROM nginx:alpine AS production

# Copy the web UI files to nginx html directory
COPY --from=builder /app/webui /usr/share/nginx/html
#COPY --from=builder /app/jq.js /usr/share/nginx/html/
#COPY --from=builder /app/*.js /usr/share/nginx/html/

# Create custom nginx configuration for SPA
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Handle SPA routing \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    \
    # Add headers for security \
    add_header X-Frame-Options "SAMEORIGIN" always; \
    add_header X-Content-Type-Options "nosniff" always; \
    add_header X-XSS-Protection "1; mode=block" always; \
    \
    # Cache static assets \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
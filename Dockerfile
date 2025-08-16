FROM nginx:alpine

# Use our custom Nginx configuration (serves /usr/share/nginx/html, proper MIME for WASM)
COPY nginx.conf /etc/nginx/nginx.conf

# Copy the repository contents into the web root.
# .dockerignore ensures dev files (node_modules, .git, etc.) are excluded.
COPY . /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
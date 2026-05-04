# syntax=docker/dockerfile:1.7

# ---------- Stage 1: build ----------
FROM node:20-alpine AS build
WORKDIR /app

# Install deps first so source changes don't bust the npm cache.
COPY package.json package-lock.json* ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy source and build. `npm run build` runs `tsc -b && vite build`.
COPY . .
RUN npm run build


# ---------- Stage 2: serve ----------
# nginx-alpine is ~20 MB and serves the static dist/ output happily. Coolify
# expects the container to listen on the port advertised by EXPOSE; 80 here.
FROM nginx:1.27-alpine AS runtime

# SPA fallback + sensible defaults: gzip, long cache for hashed assets, no
# cache for index.html so deploys are picked up immediately.
RUN <<'EOF' cat > /etc/nginx/conf.d/default.conf
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  # Compression
  gzip on;
  gzip_types text/plain text/css application/javascript application/json
             image/svg+xml font/woff2 font/woff;
  gzip_min_length 1024;

  # Hashed Vite assets — long cache, immutable.
  location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
  }

  # Fonts shipped from /public/fonts.
  location /fonts/ {
    expires 30d;
    add_header Cache-Control "public";
    try_files $uri =404;
  }

  # Manifest + icons.
  location = /manifest.webmanifest {
    add_header Cache-Control "public, max-age=300";
    try_files $uri =404;
  }
  location /icons/ {
    expires 30d;
    add_header Cache-Control "public";
    try_files $uri =404;
  }

  # SPA fallback — all unknown routes return index.html so client-side
  # routing keeps working. index.html itself is no-cache so deploys
  # propagate without a hard refresh.
  location = /index.html {
    add_header Cache-Control "no-store, must-revalidate";
  }
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Lightweight health check endpoint for Coolify.
  location = /healthz {
    access_log off;
    return 200 'ok';
    add_header Content-Type text/plain;
  }
}
EOF

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Use the default nginx entrypoint; container exits cleanly when nginx stops.
CMD ["nginx", "-g", "daemon off;"]

# Healthcheck — Coolify will read this for status reporting.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O - http://127.0.0.1/healthz || exit 1

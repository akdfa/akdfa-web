# One image = the API + the website (SERVE_SITE=true). Build context is the repo root.
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Backend deps first (better layer caching)
COPY backend/package.json backend/package-lock.json ./backend/
COPY backend/prisma ./backend/prisma
RUN cd backend && npm ci --omit=dev && npx prisma generate

# App code + the static website (only what the server's allowlist serves)
COPY backend/src ./backend/src
COPY backend/scripts ./backend/scripts
COPY *.html style.css script.js ./
COPY css ./css
COPY js ./js
COPY assets ./assets

ENV NODE_ENV=production \
    SERVE_SITE=true \
    PORT=4000
WORKDIR /app/backend
EXPOSE 4000

# Apply any pending migrations, then start. (Seed once, manually — see docs/DEPLOY.md.)
CMD ["sh", "-c", "node scripts/with-env.js npx prisma migrate deploy && node src/server.js"]

FROM node:22-slim AS builder

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci

COPY . .

ARG VITE_PHANTOM_APP_ID=
ARG VITE_PROGRAM_ID=Be5brMe2AvA68zEdiFKxa6KfYJdeQAeY12eWtZiC41vU
ARG VITE_CASINO_WALLET=3BSEfRdZsZz87EDafo5rcY87uLt6RCbPqQZsmNMxYfcu
ARG VITE_SOLANA_RPC=https://solana.drpc.org
ARG VITE_API_URL=
ARG VITE_SENTRY_DSN=

ENV VITE_PHANTOM_APP_ID=$VITE_PHANTOM_APP_ID
ENV VITE_PROGRAM_ID=$VITE_PROGRAM_ID
ENV VITE_CASINO_WALLET=$VITE_CASINO_WALLET
ENV VITE_SOLANA_RPC=$VITE_SOLANA_RPC
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN

RUN npm run build:docker

FROM node:22-slim AS runner

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV SERVE_FRONTEND=true
ENV PORT=3001

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
RUN npm ci --omit=dev --workspace=backend && npm cache clean --force

COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist
COPY backend/.env.example ./backend/.env.example

RUN mkdir -p /app/backend/data

COPY scripts/docker-entrypoint.sh /app/scripts/docker-entrypoint.sh
RUN chmod +x /app/scripts/docker-entrypoint.sh

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]

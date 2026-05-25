# Stage 1 — build du frontend
FROM node:lts-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 — image de production
FROM node:lts-alpine
WORKDIR /app

# util-linux fournit la commande `script` nécessaire pour le terminal PTY
RUN apk add --no-cache util-linux bash

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server/ ./server/
COPY --from=builder /app/dist ./dist

EXPOSE 3000
ENV NODE_ENV=production \
    PORT=3000

CMD ["node", "server/index.js"]

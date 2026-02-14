FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm config set registry https://registry.npmjs.org/
RUN npm config set fetch-retry-maxtimeout 600000
RUN npm config set fetch-retry-mintimeout 10000

# Install openssl for Prisma
RUN apt-get update -y && apt-get install -y openssl

RUN npm ci

COPY . .

# Define dummy DATABASE_URL for prisma generate (connection not needed for generation)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

RUN npx prisma generate
RUN npm run build

FROM node:20-slim

# Install ffmpeg and openssl (required for Prisma Client)
RUN apt-get update -y && apt-get install -y ffmpeg openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/uploads && chmod 777 /app/uploads

ENV PORT=3000
EXPOSE 3000

CMD ["npm", "run", "start:prod"]

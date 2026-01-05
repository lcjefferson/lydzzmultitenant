FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --verbose

COPY . .

# Define dummy DATABASE_URL for prisma generate (connection not needed for generation)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

RUN npx prisma generate
RUN npm run build

FROM node:20-alpine

# Install ffmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["npm", "run", "start:prod"]

# Build stage
FROM mirror.gcr.io/library/node:20-slim AS builder
WORKDIR /app
COPY package.json ./
COPY tsconfig.json ./
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM mirror.gcr.io/library/node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
EXPOSE 80
CMD ["node", "dist/index.js"]

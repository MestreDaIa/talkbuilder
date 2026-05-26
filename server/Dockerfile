# Build stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# Força o build e mostra se houve erro e onde os arquivos foram parar
RUN npm run build && ls -R dist

# Production stage
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
# Instala apenas dependências de produção
RUN npm install --omit=dev
# Copia o resultado do build
COPY --from=builder /app/dist ./dist
# Garante que o index.js existe antes de terminar a imagem
RUN ls -la dist/index.js

ENV NODE_ENV=production
ENV PORT=80
EXPOSE 80

CMD ["node", "dist/index.js"]

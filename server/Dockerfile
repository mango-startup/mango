# API do Mango (Node 24). Contexto de build: esta pasta (server/).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
RUN mkdir -p /dados/fotos && chown -R node:node /dados
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]

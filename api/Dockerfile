FROM node:20-alpine

WORKDIR /app

COPY api/package*.json ./
RUN npm ci

COPY api/ .
RUN npm run build

EXPOSE 3001

CMD ["node", "dist/src/index.js"]

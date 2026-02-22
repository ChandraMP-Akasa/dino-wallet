
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .

RUN npm run tsoa:gen

RUN npm run build



FROM node:20-alpine AS runner

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000

CMD ["node", "dist/index.js"]

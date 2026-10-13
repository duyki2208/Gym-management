FROM node:20-alpine AS dependencies

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

FROM node:20-alpine AS production

WORKDIR /app

RUN apk upgrade --no-cache \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

EXPOSE 5000

CMD ["node", "server.js"]

FROM node:20-alpine AS dependencies

WORKDIR /app

COPY package*.json ./

RUN npm ci \
  && npm install --no-save @rollup/rollup-linux-x64-musl@4.53.3

FROM dependencies AS development

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]

FROM dependencies AS build

COPY . .

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN test -n "$VITE_API_BASE_URL" \
  && npm run build

FROM nginx:alpine AS production

RUN apk upgrade --no-cache

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

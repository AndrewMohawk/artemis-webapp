FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . ./
RUN npm run build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app

RUN apk add --no-cache wget \
    && addgroup -S artemis \
    && adduser -S -G artemis artemis

COPY --from=build --chown=artemis:artemis /app/dist/standalone ./

USER artemis

EXPOSE 3000

CMD ["node", "server.js"]

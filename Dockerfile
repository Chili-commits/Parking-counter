FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_FILE=/app/data/data.json \
    DOCKER_CONTAINER=true

COPY --chown=node:node server.js ./
COPY --chown=node:node public ./public

RUN mkdir -p /app/data && chown node:node /app/data

USER node

EXPOSE 3000

CMD ["node", "server.js"]

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node server/src ./src
COPY --chown=node:node server/scripts/workerHealth.js ./scripts/workerHealth.js
RUN mkdir -p uploads && chown node:node uploads
USER node
EXPOSE 5000
CMD ["node", "src/server.js"]

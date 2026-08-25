FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node package.json server.mjs public-files.mjs ./
COPY --chown=node:node *.html *.js *.css *.txt *.xml ./
COPY --chown=node:node assets ./assets
COPY --chown=node:node guides ./guides
COPY --chown=node:node alternatives ./alternatives
RUN mkdir -p /app/.data/secrets && chown -R node:node /app/.data

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "server.mjs"]

FROM node:22-alpine

WORKDIR /app

# npm workspaces needs every workspace manifest before installing from the root lockfile.
COPY package.json package-lock.json ./
COPY apps/client/package.json ./apps/client/package.json
COPY apps/server/package.json ./apps/server/package.json
RUN npm ci --omit=dev

COPY apps/server ./apps/server

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=1234 \
    YPERSISTENCE=/data

RUN mkdir -p /data && chown -R node:node /app /data
USER node

EXPOSE 1234
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=12 \
  CMD node -e "const net=require('node:net');const s=net.connect(1234,'127.0.0.1',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),2000)"

CMD ["npm", "run", "start", "--workspace=apps/server"]

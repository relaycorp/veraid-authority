FROM node:18.14.0 as build
WORKDIR /tmp/veraid-authority
COPY package*.json ./
RUN npm ci
COPY . ./
RUN npm run build && npm prune --omit=dev && rm -r src

FROM node:18.14.0-slim
LABEL org.opencontainers.image.source="https://github.com/relaycorp/veraid-authority"
WORKDIR /opt/veraid-authority
COPY --from=build /tmp/veraid-authority ./
USER node
ENTRYPOINT [ \
  "node", \
  "--unhandled-rejections=strict", \
  "--experimental-vm-modules", \
  "--enable-source-maps", \
  "build/main/bin/server.js" \
  ]
EXPOSE 8080

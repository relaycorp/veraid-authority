FROM node:18.14.0 as build
WORKDIR /tmp/veraid-authority
COPY package*.json ./
RUN npm install
COPY . ./
RUN npm run build && npm prune --omit=dev && rm -r src

FROM node:18.14.0-slim
WORKDIR /opt/veraid-authority
COPY --from=build /tmp/veraid-authority ./
USER node
ENTRYPOINT ["node", "--unhandled-rejections=strict", "--experimental-vm-modules", "--enable-source-maps"]
EXPOSE 8080

FROM node:18-alpine

WORKDIR /app

# copy package manifests and install
COPY package*.json ./
RUN npm install --production --no-audit --no-fund

# copy source
COPY . ./

# garante que os diretórios de dados existam
RUN mkdir -p /app/uploads /app/data

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD wget -qO- http://localhost:4000/health || exit 1
CMD ["node", "index.js"]

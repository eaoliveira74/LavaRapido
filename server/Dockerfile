FROM node:18-alpine
WORKDIR /app

# install dependencies
COPY package*.json ./
RUN npm ci --production

# copy source
COPY . ./

# ensure data directories exist
RUN mkdir -p /app/uploads /app/data

EXPOSE 4000
CMD ["node", "index.js"]

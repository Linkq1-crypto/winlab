FROM node:20-alpine

WORKDIR /app

# Network isolation is enforced by `docker run --network=none`.
COPY . .

RUN npm install --production

CMD ["node", "index.js"]

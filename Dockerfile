FROM node:20-alpine

RUN apk add --no-cache openssl

EXPOSE 3000
WORKDIR /app
ENV NODE_ENV=production

COPY . .
RUN npm ci

RUN npm run build

CMD ["npm", "run", "docker-start"]

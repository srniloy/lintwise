FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN ./node_modules/.bin/prisma generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:dev"]

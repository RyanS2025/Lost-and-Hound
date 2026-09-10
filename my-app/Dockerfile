FROM node:22-alpine

WORKDIR /app

# Install frontend deps
COPY package.json package-lock.json ./
RUN npm ci

# Copy frontend source and build
COPY . .
RUN npm run build

# Install backend deps
WORKDIR /app/backend
RUN npm ci --omit=dev

EXPOSE 8080
CMD ["node", "server.js"]

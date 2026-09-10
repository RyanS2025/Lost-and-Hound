FROM node:22-alpine

WORKDIR /app

# Install frontend deps
COPY package.json package-lock.json ./
RUN npm ci

# Vite bakes VITE_* env vars at build time
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_GOOGLE_MAPS_API_KEY
ARG VITE_API_URL

# Copy frontend source and build
COPY . .
RUN npm run build

# Install backend deps
WORKDIR /app/backend
RUN npm ci --omit=dev

EXPOSE 8080
CMD ["node", "server.js"]

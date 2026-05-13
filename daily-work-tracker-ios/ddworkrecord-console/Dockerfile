FROM node:22-alpine AS base
WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci

# Copy sources
COPY . .

# Build frontend
RUN npm run build

# Preview (serves built assets)
EXPOSE 4173
CMD ["npm","run","preview"]

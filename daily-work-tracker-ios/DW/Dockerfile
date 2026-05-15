# Use the official Node.js 20 image as the base
FROM node:20-slim AS builder

WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your application code
COPY . .

# Build the TypeScript project
RUN npm run build

# Production stage
FROM node:20-slim
WORKDIR /usr/src/app

# Copy only what's needed to run the app
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=3000
# App listens on PORT (see src/server.ts)
EXPOSE 3000
CMD [ "npm", "start" ]

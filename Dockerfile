# Use official Node.js 18 Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Provide dummy build-time environment variables for Next.js build
ARG SESSION_SECRET="dummy_build_secret"
ARG DATABASE_URL="dummy_database_url"
ARG DIRECT_DATABASE_URL="dummy_direct_database_url"
ARG TOKEN_ENCRYPTION_KEY="dummy_token_encryption_key"
ARG NEXTAUTH_SECRET="dummy_nextauth_secret"

# Build the Next.js application
RUN npm run build

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]

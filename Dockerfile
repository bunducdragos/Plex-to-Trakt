# Use Node.js LTS version
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (tsx is needed at runtime)
RUN npm install

# Copy application files
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Create directory for database
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Start script that runs migrations on first start and then starts the app
CMD npx prisma migrate deploy && npm start

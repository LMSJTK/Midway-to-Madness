# Use a Node image that includes common build dependencies
FROM node:22-bullseye-slim

# Install Python and build tools required for better-sqlite3 compilation
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the ports for Vite and Express
EXPOSE 3000 3001
# Use a slim and secure base image
FROM node:18-alpine

LABEL cache_buster="2025-10-05T18:05:00"

WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Expose the port the app runs on
EXPOSE 5000

# Command to run the application
CMD ["node", "server.js"]

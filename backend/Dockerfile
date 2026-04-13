# Use the official Node.js image.
# https://hub.docker.com/_/node
FROM node:20-alpine

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
# A wildcard is used to ensure both package.json AND package-lock.json are copied.
COPY package*.json ./

# Install production dependencies.
RUN npm install --omit=dev

# Copy local code to the container image.
COPY . .

# Cloud Run expects the container to listen on the port defined by the PORT environment variable.
# We don't necessarily need to expose a port in the Dockerfile for Cloud Run, but it's good documentation.
EXPOSE 8080

# Run the web service on container startup.
CMD [ "npm", "start" ]

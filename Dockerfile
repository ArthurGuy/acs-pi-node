
FROM resin/rpi-node:0.10.36

# Move all the files into the default /app directory
COPY . /app

WORKDIR /app

# Run npm install to load dependencies
RUN npm install

# Start the node service
CMD ["node", "server.js"]
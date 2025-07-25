FROM node:22

WORKDIR /app

# Copy everything
COPY . .

# Install server dependencies
RUN cd server && npm install

# Install client dependencies
RUN cd client && npm install --legacy-peer-deps

# Accept build argument from fly.toml and set as environment variable
ARG REACT_APP_GOOGLE_CLIENT_ID
ENV REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID

# Build client (now with the Google Client ID available)
RUN cd client && npm run build

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "server/server.js"]
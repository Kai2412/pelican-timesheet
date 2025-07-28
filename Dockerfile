FROM node:22

WORKDIR /app

# Copy everything
COPY . .

# Install server dependencies
RUN cd server && npm install

# Install client dependencies
RUN cd client && npm install --legacy-peer-deps

# Mount secrets during build and use them for React build
RUN --mount=type=secret,id=REACT_APP_GOOGLE_CLIENT_ID \
    --mount=type=secret,id=REACT_APP_ADMIN_PASSWORD \
    cd client && \
    export REACT_APP_GOOGLE_CLIENT_ID=$(cat /run/secrets/REACT_APP_GOOGLE_CLIENT_ID) && \
    export REACT_APP_ADMIN_PASSWORD=$(cat /run/secrets/REACT_APP_ADMIN_PASSWORD) && \
    npm run build

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "server/server.js"]
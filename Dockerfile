FROM node:22

WORKDIR /app

# Copy everything
COPY . .

# Install server dependencies
RUN cd server && npm install

# Install client dependencies
RUN cd client && npm install --legacy-peer-deps

# Accept build arguments and set as environment variables
ARG REACT_APP_GOOGLE_CLIENT_ID
ARG VITE_API_BASE_URL
ENV REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build the React app (now with environment variables available)
RUN cd client && npm run build

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "server/server.js"]
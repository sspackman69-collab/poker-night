# Single-image build for Fly.io (or any container host).
# Builds the client, then runs the server which serves that build + Socket.IO.
FROM node:20-alpine

WORKDIR /app

# Copy the whole repo and build (root build script installs server + client
# deps and runs the Vite build).
COPY . .
RUN npm run build

ENV NODE_ENV=production
# Fly routes to this internal port (see fly.toml). Hosts that inject their own
# PORT will override this.
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]

# The taab API only. The app itself is built with Expo/EAS, not here.
# The server needs Node 24+ for the built-in node:sqlite module.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Install scripts are for the Expo app's native tooling; the server bundle doesn't need them.
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.json ./
COPY server ./server
COPY src ./src
RUN npm run server:build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    DATABASE_PATH=/data/taab.sqlite
COPY --from=build /app/build/server/index.mjs ./index.mjs
EXPOSE 3001
CMD ["node", "index.mjs"]

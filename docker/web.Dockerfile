FROM node:22-bookworm-slim

ENV NODE_ENV=development \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 4173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "4173"]

FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY server.cjs ./server.cjs
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["npm", "start"]

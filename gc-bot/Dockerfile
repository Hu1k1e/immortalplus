FROM node:20-slim

WORKDIR /app

COPY package.json .
RUN npm install --omit=dev

COPY index.js .

ENV PORT=3500
ENV DATA_DIR=/app/data

EXPOSE 3500

CMD ["node", "index.js"]

# syntax = docker/dockerfile:1.0-experimental

FROM node:14-alpine
COPY package.json package.json
COPY package-lock.json package-lock.json
COPY index.js index.js
COPY token.js token.js
RUN npm ci
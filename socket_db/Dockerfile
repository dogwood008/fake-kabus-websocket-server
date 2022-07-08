# syntax = docker/dockerfile:1.0-experimental

FROM node:16-alpine
WORKDIR /app

COPY package.json package.json
COPY package-lock.json package-lock.json
RUN npm ci

COPY index.js index.js
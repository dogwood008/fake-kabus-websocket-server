# syntax = docker/dockerfile:1.0-experimental

FROM node:20-alpine
WORKDIR /tmp
COPY package.json package.json
COPY package-lock.json package-lock.json
RUN npm ci

WORKDIR /app
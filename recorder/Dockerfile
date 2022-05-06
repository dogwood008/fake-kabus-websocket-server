# syntax = docker/dockerfile:1.0-experimental

FROM ruby:3.1-alpine
WORKDIR /tmp
COPY Gemfile Gemfile
COPY Gemfile Gemfile.lock
RUN bundle install

WORKDIR /app
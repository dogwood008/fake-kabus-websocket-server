'use strict';

// ref: https://shizenkarasuzon.hatenablog.com/entry/2021/04/21/004132

const protocol = process.env.PROTOCOL;
const host = process.env.HOST;
const port = process.env.PORT;
const path = process.env.WEBSOCKET_PATH || '/';
const server = `${protocol}://${host}:${port}${path}`;

import WebSocket from 'ws';

console.log(server)
const ws = new WebSocket(server);

ws.on('open', function open() {
  ws.send('something');
});

ws.on('error', function (event) {
  console.log(event)
});

ws.on('message', function message(data) {
  console.log('%s', data);
});
'use strict';

import { WebSocketServer } from 'ws';

export class WebSocketManager {
  constructor ({ host = process.env.HOST, port = process.env.PORT }){
    this.wss = new WebSocketServer({ host, port });
  }

  async setup (startCallback, stopCallback=null) {
    const that = this;
    // 接続開始
    this.wss.on('connection', async function connection(ws) {
      console.log('WebSocket connected.')
      await startCallback(ws);  // コネクションを確立させてから送り始める

      ws.on('close', function close() {
        console.log('close');
        if (stopCallback) {
          console.log('stopCallback');
          stopCallback();
        }
      })
    });
  }
}

'use strict';

// ref: https://shizenkarasuzon.hatenablog.com/entry/2021/04/21/004132

import { WebSocketManager } from './web_socket_manager.js';
import { SQLExecuter } from './sql_executer.js';
import { DBManager } from './db_manager.js';
import { LoopProcedure } from './loop_procedure.js';

const debug = !!process.env.DEBUG;

const main = async (fromDt) => {
  try {
    const stockCode = 7974;
    const dbManager = new DBManager({});
    const loopProcedure = await LoopProcedure.build({ dbManager, stockCode, fromDt, verbose: true });
    let fetchMessagesSub, prefetchDbSub;
    let [isStarted, reStart] = [false, false];

    const startCallback = async (websocket) => {
      if (isStarted) {
        console.warn('[WARN] already started.');
        return;
      }
      if (reStart) {
        console.log('restart');
        const initialResult = await SQLExecuter.recordsWithinSecondsAfter(dbManager, stockCode, loopProcedure.getFirstDateTimeInDb(), 20)
        console.log(initialResult)
        loopProcedure.setQueue(
          LoopProcedure.convertSQLResultToHash(initialResult))
      }
      isStarted = true
      fetchMessagesSub = await loopProcedure.fetchMessagesOnEachSeconds({ callback: currentValues => {
          console.log(currentValues);
          if (!currentValues.length) { return; }
          //websocket.send(currentValues);
          const msg = JSON.stringify(currentValues);
          websocket.send(msg);
        }
      });
      prefetchDbSub = await loopProcedure.prefetchFromDb({});
    }
    const websocketManager = new WebSocketManager({});
    await websocketManager.setup(startCallback, function() {
      fetchMessagesSub.unsubscribe();
      prefetchDbSub.unsubscribe();
      isStarted = false;
      reStart = true;
    })

  } catch (e) {
    console.error(e);
  }
}

console.log('socket_db started.')
const args = process.argv.slice(2, process.argv.length)
const fromDt = args[0] // '2022-06-21T09:00:00';
await main(fromDt);
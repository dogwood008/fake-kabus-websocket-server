'use strict';

// ref: https://shizenkarasuzon.hatenablog.com/entry/2021/04/21/004132

import { WebSocketManager } from './web_socket_manager.js'
import { SQLExecuter } from './sql_executer.js'

const debug = !!process.env.DEBUG;

import pg from 'pg';
import { interval, map, delay, tap, switchMap } from 'rxjs';

const { Pool } = pg;
class DBManager {
  constructor({host, user, password, port, database }) {
    host = host || process.env.POSTGRES_HOST
    user = user || process.env.POSTGRES_USER
    password = password || process.env.POSTGRES_PASSWORD
    port = port || process.env.POSTGRES_PORT
    database = database || process.env.POSTGRES_DB_NAME

    this.pool = new Pool({ host, user, password, port, database });
    this.connect = null;
  }
  async client() {
    if (!this.connect) {
      this.connect = await this.pool.connect();
    }
    return this.connect;
  }
}

class LoopProcedure {
  A_SECOND_IN_MILLISECONDS = 1000;  // ここを300に変更すると、0.3秒毎に内部時間が1秒進んだ扱いにできる

  // 非同期処理を初期化時に行いたいので、new LoopProcedureではなくLoopProcedure.buildを使うこと
  static async build ({ dbManager, stockCode, fromDt, verbose = false }) {
    const { firstDtInDb, queue } = await this.initialFetch(dbManager, stockCode, fromDt);
    return new LoopProcedure({ firstDtInDb, queue, dbManager, stockCode, verbose });
  }

  // 与えたfromDt以降で見つかる最古のレコードから20秒分取得する
  static async initialFetch (dbManager, stockCode, fromDt) {
    const initialFetchSeconds = 20;
    const firstDtInDb = await SQLExecuter.firstDtInDb(dbManager, stockCode, fromDt);
    console.log(firstDtInDb);  // タイムゾーンがZで返るが、システム全域でタイムゾーンの扱いを厳密にする必要が無いので、許容する
    const result = await SQLExecuter.recordsWithinSecondsAfter(dbManager, stockCode, firstDtInDb, initialFetchSeconds);
    return { firstDtInDb, queue: this.convertSQLResultToHash(result) };
  }

  static convertSQLResultToHash (result) {
    const hash = {};
    result.forEach(row => {
      const dtStr = row.datetime.toISOString()
      const val = hash[dtStr] ? hash[dtStr] : [];
      val.push(row.data);
      hash[dtStr] = val;
    });
    return hash;
  }

  constructor({ firstDtInDb, queue, dbManager, stockCode, verbose = false }) {
    this.firstDtInDb = firstDtInDb;
    this.queue = queue;
    this.dbManager = dbManager;
    this.stockCode = stockCode;
    this.verbose = verbose;
  }

  // callback({ dt, currentValues })は、そのdt(年月日時分秒をISO8601で)における、
  // currentValue(生データをDBから取り出した値が配列で入っている)を引数にとる
  async fetchMessagesOnEachSeconds ({ callback, verbose = false }) {
    const verboseFlag = verbose || this.verbose;
    return interval(this.A_SECOND_IN_MILLISECONDS * 1)
      .pipe(
        map(secs => addSeconds(this.firstDtInDb, secs)),  // 毎秒現在時刻を進める
        map(dt => dt.toISOString()),
        map(dt => { return { dt, currentValues: this.queue[dt] || []} }),
        tap(({ dt, currentValues }) => verboseFlag ? console.log(`[${dt}] currentValues.length: ${currentValues.length}`) : null),
      )
      .subscribe(async ({ dt, currentValues }) => {
        // currentValues には、そのdt(年月日時分秒)における生データをDBから取り出した値が配列で入っている
        callback(currentValues);
        this.queue[dt] = undefined;  // for garbage collection
      })
  }
  
  // DBからプリフェッチする
  async prefetchFromDb ({
      delaySeconds = 5,  // 最初に20秒分取得しているので、初めのプリフェッチを5秒ずらす
      prefetchSecondsRange = 10,  // 10秒毎に取りに行く
      prefetchSecondsWithGraceRange = null, // DBの応答が遅いのを見越して13秒先までを取りに行く
      verbose = false,  // verboseモード
      callback = null,  // callback({ dt, currentValues })は、そのdt(年月日時分秒をISO8601で)における、
                        // currentValue(生データをDBから取り出した値が配列で入っている)を引数にとる
    }) {
    if (!prefetchSecondsWithGraceRange) {
      prefetchSecondsWithGraceRange = prefetchSecondsRange + 3 // DBの応答が遅いのを見越して13秒先までを取りに行く
    }
    const verboseFlag = verbose || this.verbose;

    return interval(this.A_SECOND_IN_MILLISECONDS * prefetchSecondsRange)
      .pipe(
        delay(this.A_SECOND_IN_MILLISECONDS * delaySeconds),
        map(i => prefetchSecondsRange * (i + 2)), // 最初に20秒分取得しているので、プリフェッチを20秒ずらす
        map(seconds => addSeconds(this.firstDtInDb, seconds)),
        tap(dt => verboseFlag ? console.log(`[prefetch] ${dt.toISOString()} -- ${addSeconds(dt, prefetchSecondsWithGraceRange).toISOString()}`) : null),
        switchMap(async (fromDt) =>
          await SQLExecuter.recordsWithinSecondsAfter(this.dbManager, this.stockCode, fromDt, prefetchSecondsWithGraceRange)),
        map(result => LoopProcedure.convertSQLResultToHash(result)),
      )
      .subscribe(async result => {
        for(const [key, value] of Object.entries(result)) {
          if (callback) {
            callback({ dt: key, currentValues: value });
          }
          this.queue[key] = value
        }
      })
  }

  // callback({ dt, currentValues })は、そのdt(年月日時分秒をISO8601で)における、currentValue(生データをDBから取り出した値が配列で入っている)を引数にとる
  async subscribePrefetchFromDb (observable, callback = null) {
    observable.subscribe(async result => {
      for(const [key, value] of Object.entries(result)) {
        if (callback) {
          callback({ dt: key, currentValues: value });
        }
        this.queue[key] = value
      }
    })
  }

  setQueue(queue) {
    this.queue = queue;
  }

  getFirstDateTimeInDb() {
    return this.firstDtInDb;
  }
}



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
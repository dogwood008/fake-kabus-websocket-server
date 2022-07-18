'use strict';

// ref: https://shizenkarasuzon.hatenablog.com/entry/2021/04/21/004132

import { WebSocketServer } from 'ws';
const debug = !!process.env.DEBUG;

class SQLExecuter {
  // 指定した日時以降で最も最初に存在するDateTime
  static async firstDtInDb (dbManager, stockCode, fromDt) {
    const client = await dbManager.client();
    return (await client.query(`
        SELECT datetime from stock_${stockCode}_raw
          WHERE datetime >= $1
          ORDER BY id ASC
          LIMIT 1;`, [fromDt])).rows[0].datetime;
  }

  static async recordsWithinSecondsAfter (dbManager, stockCode, fromDt, seconds) {
    const client = await dbManager.client();
    const until = addSeconds(new Date(fromDt), seconds);
    return (await client.query(`
        SELECT * from stock_${stockCode}_raw
          WHERE datetime >= $1
          AND datetime < $2
          ORDER BY id ASC
          LIMIT 10000;`, [fromDt, until])).rows;
  }
}

import pg from 'pg';
import { addSeconds } from 'date-fns'
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
}


class WebSocketManager {
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

const main = async (fromDt) => {
  try {
    const stockCode = 7974;
    const dbManager = new DBManager({});
    const loopProcedure = await LoopProcedure.build({ dbManager, stockCode, fromDt, verbose: true });
    let fetchMessagesSub, prefetchDbSub;
    let isStarted = false;

    const startCallback = async (websocket) => {
      if (isStarted) {
        console.warn('[WARN] already started.');
        return;
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
    })

  } catch (e) {
    console.error(e);
  }
}

console.log('socket_db started.')
const args = process.argv.slice(2, process.argv.length)
const fromDt = args[0] // '2022-06-21T09:00:00';
await main(fromDt);
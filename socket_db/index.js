'use strict';

// ref: https://shizenkarasuzon.hatenablog.com/entry/2021/04/21/004132

import { WebSocketServer } from 'ws';
const wss = new WebSocketServer({
  host: process.env.HOST,
  port: process.env.PORT,
});

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
    interval(this.A_SECOND_IN_MILLISECONDS * 1)
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
      callback = null,  // callback({ dt, currentValues })は、そのdt(年月日時分秒をISO8601で)における、currentValue(生データをDBから取り出した値が配列で入っている)を引数にとる
      verbose = false,  // verboseモード
    }) {
    if (!prefetchSecondsWithGraceRange) {
      prefetchSecondsWithGraceRange = prefetchSecondsRange + 3 // DBの応答が遅いのを見越して13秒先までを取りに行く
    }
    const verboseFlag = verbose || this.verbose;

    interval(this.A_SECOND_IN_MILLISECONDS * prefetchSecondsRange)
      .pipe(
        delay(this.A_SECOND_IN_MILLISECONDS * delaySeconds),
        map(i => prefetchSecondsRange * (i + 2)), // 最初に20秒分取得しているので、プリフェッチを20秒ずらす
        map(seconds => addSeconds(this.firstDtInDb, seconds)),
        tap(dt => verboseFlag ? console.log(`[prefetch] ${dt.toISOString()} -- ${addSeconds(dt, prefetchSecondsWithGraceRange).toISOString()}`) : null),
        switchMap(async (fromDt) =>
          await SQLExecuter.recordsWithinSecondsAfter(this.dbManager, this.stockCode, fromDt, prefetchSecondsWithGraceRange)),
        map(result => LoopProcedure.convertSQLResultToHash(result)),
      )
      .subscribe(result => {
        for(const [key, value] of Object.entries(result)) {
          if (callback) {
            callback({ dt: key, currentValues: value });
          }
          this.queue[key] = value
        }
      })
  }
}


const main = async () => {
  const dbManager = new DBManager({});
  const stockCode = 7974;
  const fromDt = '2022-06-21T09:00:00';

  try {
    const loopProcedure = await LoopProcedure.build({ dbManager, stockCode, fromDt, verbose: true });

    await loopProcedure.fetchMessagesOnEachSeconds({ callback: (currentValues) => {
      // TODO: ここでWebSocketメッセージを流す
      console.log(currentValues);
    } });

    await loopProcedure.prefetchFromDb({});

  } catch (e) {
    console.error(e);
  }
}

await main();

////////////////////////////////////////////////////////////////////////////////////////

// https://note.kiriukun.com/entry/20191124-iso-8601-in-javascript
// const currentTime = () => new Date().toISOString().split('Z')[0] + '+09:00';

/* const output = (() => {
  return {
    "OverSellQty": 187600, // OVER気配数量
    "UnderBuyQty": 115300, // UNDER気配数量
    "TotalMarketValue": 7222044650000, // 時価総額
    "MarketOrderSellQty": 0, // 売成行数量
    "MarketOrderBuyQty": 0, // 買成行数量
    "BidTime": "2021-09-10T11:12:23+09:00", // 最良売気配時刻
    "AskTime": "2021-09-10T11:12:23+09:00", // 最良買気配時刻
    "Exchange": 1, // 市場コード
    "ExchangeName": "東証１部", // 市場名称
    "TradingVolume": 476400, // 売買高
    "TradingVolumeTime": currentTime(), // 売買高時刻
    "VWAP": 54702.097, // 売買高加重平均価格(VWAP)
    "TradingValue": 26060079000, // 売買代金
    "BidQty": 600, // 最良売気配数量
    "BidPrice": 54870, // 最良売気配値段
    "BidSign": "0101", // 最良売気配フラグ
    "Sell1": { // 売気配数量1本目
      "Price": 54870, // 値段
      "Qty": 600, // 数量
      "Sign": "0101", // 気配フラグ
      "Time": "2021-09-10T11:12:23+09:00" // 時刻
    },
    "Sell2": {
      "Price": 54880,
      "Qty": 600
    },
    "Sell3": {
      "Price": 54890,
      "Qty": 1500
    },
    "Sell4": {
      "Price": 54900,
      "Qty": 1400
    },
    "Sell5": {
      "Price": 54910,
      "Qty": 500
    },
    "Sell6": {
      "Price": 54920,
      "Qty": 800
    },
    "Sell7": {
      "Price": 54930,
      "Qty": 900
    },
    "Sell8": {
      "Price": 54940,
      "Qty": 800
    },
    "Sell9": {
      "Price": 54950,
      "Qty": 800
    },
    "Sell10": {
      "Price": 54960,
      "Qty": 800
    },
    "AskQty": 200, // 最良買気配数量
    "AskPrice": 54840, // 最良買気配値段
    "AskSign": "0101", // 最良買気配フラグ
    "Buy1": { // 買気配数量1本目
      "Price": 54840,
      "Qty": 200,
      "Sign": "0101",
      "Time": "2021-09-10T11:12:23+09:00"
    },
    "Buy2": {
      "Price": 54830,
      "Qty": 500
    },
    "Buy3": {
      "Price": 54820,
      "Qty": 500
    },
    "Buy4": {
      "Price": 54810,
      "Qty": 1000
    },
    "Buy5": {
      "Price": 54800,
      "Qty": 600
    },
    "Buy6": {
      "Price": 54790,
      "Qty": 1400
    },
    "Buy7": {
      "Price": 54780,
      "Qty": 700
    },
    "Buy8": {
      "Price": 54770,
      "Qty": 1000
    },
    "Buy9": {
      "Price": 54760,
      "Qty": 300
    },
    "Buy10": {
      "Price": 54750,
      "Qty": 400
    },
    "Symbol": "7974", // 銘柄コード
    "SymbolName": "任天堂", // 銘柄名
    "CurrentPrice": 54850, // 現値
    "CurrentPriceTime": currentTime(), // 現値時刻
    "CurrentPriceChangeStatus": "0056", // 現値前値比較
    "CurrentPriceStatus": 1, // 現値ステータス
    "CalcPrice": 54850, // 計算用現値
    "PreviousClose": 54340, // 前日終値
    "PreviousCloseTime": "2021-09-09T00:00:00+09:00", // 前日終値日付
    "ChangePreviousClose": 510, // 前日比
    "ChangePreviousClosePer": 0.94, // 騰落率
    "OpeningPrice": 54400, // 始値
    "OpeningPriceTime": "2021-09-10T09:00:00+09:00", // 始値時刻
    "HighPrice": 55090, // 高値
    "HighPriceTime": "2021-09-10T09:07:49+09:00", // 高値時刻
    "LowPrice": 54400, // 安値
    "LowPriceTime": "2021-09-10T09:00:00+09:00", // 安値時刻
    "SecurityType": 1
  }
}); */


/*

const randomSeconds = (() => {
  return Math.max(800, Math.floor(Math.random() * 1000) + 500);
});

const send = (ws => {
  const msg = JSON.stringify(output());
  const randomDelay = randomSeconds();
  console.log(randomDelay)
  ws.send(msg)
  setTimeout(() => send(ws), randomDelay)  // 終了するまで無限ループ
});

///////////////////////////////////////////////////


wss.on('close', function incoming(event) {
  console.log(event);
  console.log('close');
})

wss.on('connection', async function connection(ws) {
  send(ws);
});
*/
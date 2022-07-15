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
  static async firstDtInDB (dbManager, stockCode, fromDt) {
    const client = await dbManager.client();
    return (await client.query(`
        SELECT datetime from stock_${stockCode}_raw
          WHERE datetime >= $1
          ORDER BY id ASC
          LIMIT 1;`, [fromDt])).rows[0].datetime;
  }

  static async recordsWithinOneMinuteAfter (dbManager, stockCode, fromDt) {
    const client = await dbManager.client();
    const minutes = 1;
    const until = addMinutes(new Date(fromDt), minutes);
    console.log(until)
    return (await client.query(`
        SELECT * from stock_${stockCode}_raw
          WHERE datetime >= $1
          AND datetime < $2
          ORDER BY id ASC
          LIMIT 10000;`, [fromDt, until])).rows;
  }
}

import pg from 'pg';
import { addMinutes } from 'date-fns'
import { Observable } from 'rxjs';

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

const main = async () => {
  const dbman = new DBManager({});
  const stockCode = 7974;

  try{
    const fromDt = '2022-06-21T09:00:00';
    const firstDtinDB = await SQLExecuter.firstDtInDB(dbman, stockCode, fromDt);
    console.log(firstDtinDB);
    const result = await SQLExecuter.recordsWithinOneMinuteAfter(dbman, stockCode, firstDtinDB);
    console.log(result)


  //const from = '2022-01-01';
  //const to = '2022-01-02';
  //const result = await connect.query(`
  //  SELECT * from stock_${stockCode}_raw
  //    WHERE datetime >= $1 AND datetime <= $2
  //    ORDER BY id DESC;
  //`, from, to);
  //console.log(result);
  } catch (e) {
    console.error(e);
  }
}

(async () => {
  await main();
})()

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
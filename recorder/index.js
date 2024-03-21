'use strict';

// ref: https://shizenkarasuzon.hatenablog.com/entry/2021/04/21/004132

import WebSocket from 'ws';

// ref: https://stackoverflow.com/q/70306590/15983717
import pg from 'pg';
const { Pool } = pg;

function initWebSocket () {
  const protocol = process.env.PROTOCOL;
  const host = process.env.HOST;
  const port = process.env.PORT;
  const path = process.env.WEBSOCKET_PATH || '/';
  const server = `${protocol}://${host}:${port}${path}`;

  console.log(server)
  return new WebSocket(server);
}

function createDbSql(dbName) {
   return `SELECT 'CREATE DATABASE ${dbName}'
      WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${dbName}');`
}

async function createDb(dbName, connect) {
  const createDbSqlStatement = createDbSql(dbName);
  console.log(createDbSqlStatement)
  await connect.query(createDbSqlStatement);
}

async function createTable({ connect, commonTableName }) {
  const sql = createTableSql({ commonTableName });
  console.log({sql})
  console.log(await connect.query(sql));
}

function createTableSql({ commonTableName }) {
  return `CREATE TABLE IF NOT EXISTS stock_raw (
      id SERIAL NOT NULL UNIQUE PRIMARY KEY,
      stockcode VARCHAR(9) NOT NULL,
      datetime TIMESTAMP NOT NULL,
      data TEXT NOT NULL
    );`
    + ` CREATE INDEX IF NOT EXISTS stock_raw_id_index`
    + ` ON stock_raw (id);`
    + ` CREATE INDEX IF NOT EXISTS stock_raw_stockcode_index`
    + ` ON stock_raw (stockcode);`
    + ` CREATE INDEX IF NOT EXISTS stock_raw_datetime_index`
    + ` ON stock_raw (datetime);`
    + ` CREATE INDEX IF NOT EXISTS stock_raw_stock_code_datetime_index`
    + ` ON stock_raw (stockcode, datetime);`
    + ` CREATE TABLE IF NOT EXISTS ${commonTableName} (
      id SERIAL NOT NULL UNIQUE PRIMARY KEY,
      datetime TIMESTAMP NOT NULL,
      stockcode TEXT NOT NULL,
      price DECIMAL NOT NULL,
      volume INTEGER NOT NULL,
      accumulated_volume INTEGER NOT NULL
    );`
    + ` CREATE INDEX IF NOT EXISTS ${commonTableName}_id_index`
    + ` ON ${commonTableName} (id);`
    + ` CREATE INDEX IF NOT EXISTS ${commonTableName}_datetime_index`
    + ` ON ${commonTableName} (datetime);`
    + ` CREATE INDEX IF NOT EXISTS ${commonTableName}_stockcode_index`
    + ` ON ${commonTableName} (stockcode);`
    + ` CREATE INDEX IF NOT EXISTS ${commonTableName}_stockcode_datetime_index`
    + ` ON ${commonTableName} (stockcode, datetime);`
}

function insertRawJsonMessageSql({ json }) {
  const dateTime = json.TradingVolumeTime;
  const stockCode = json.Symbol;
  return `INSERT INTO stock_raw (stockcode, datetime, data) VALUES (
    '${stockCode}',
    '${dateTime}',
    '${JSON.stringify(json)}'
    );`;
}

function insertRawJsonMessage({ json, connect, debug }) {
  const sql = insertRawJsonMessageSql({ json });
  const output = debug ?
    () => console.log(`[Raw] [${json.Symbol}] ${json.TradingVolumeTime} ${JSON.stringify(json)}`) : null;
  connect.query(sql).then(output).catch((err) => console.error(err));
}

function insertTickDataSql({ price, volume, accumulatedVolume, json, commonTableName }) {
  const { dateTime, stockCode } = valuesFromJson(json);
  return `INSERT INTO ${commonTableName} (datetime, stockcode, price, volume, accumulated_volume) VALUES (
    '${dateTime}',
    '${stockCode}',
    '${price}',
    '${volume}',
    '${accumulatedVolume}'
    );`;
}

function insertTickData({ volume, accumulatedVolume, json, commonTableName, connect, verbose }) {
  const { dateTime, price } = valuesFromJson(json);
  const sql = insertTickDataSql({ price, volume, accumulatedVolume, json, commonTableName, connect });
  const stockCode = json.Symbol;
  const output = verbose ?
    () => console.log(`[Tick] [${stockCode}] ${dateTime} JPY: ${price.toString().padStart(5, ' ')} / Vol: ${volume.toString().padStart(7, ' ')} (${accumulatedVolume.toString().padStart(7, ' ')})`) : null;
  connect.query(sql).then(output).catch((err) => console.error(err));
}

async function initPg({ commonTableName }) {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB_NAME,
  });
  const connect = await pool.connect();
  await createDb(process.env.POSTGRES_DB_NAME, connect);
  await createTable({ connect, commonTableName });

  return { pool, connect };
}

function valuesFromJson(json) {
  const dateTime = json.TradingVolumeTime;
  const volume = json.TradingVolume;
  const price = json.CalcPrice;
  const stockCode = json.Symbol;
  return { dateTime, volume, price, stockCode };
}

async function exit(connect, pool) {
  await connect.release();
  await pool.end();
}

async function main({ pool, connect, commonTableName, debug, verbose }) {
  let currentTradingVolumeTime = null;
  let currentTradingAccumulatedVolume = 0;

  ws.on('open', function open() {
    console.log('open');
  });
  
  ws.on('error', async function (event) {
    console.log(event);
    await exit({ connect, pool });
  });
  
  ws.on('close', async function close() {
    await exit({ connect, pool });
  });

  ws.on('message', async function message(data) {
    if (debug) { console.log('%s', data.toString()); }
    const json = JSON.parse(data.toString());
    const tradingVolumeTime = json.TradingVolumeTime;
    insertRawJsonMessage({ json, connect, debug }) // 全てのメッセージを保存

    if (currentTradingVolumeTime === tradingVolumeTime) {
      // 取引量が変わっていなかったら、新規メッセージが到着しても共通テーブルに入れない
      return;
    }

    const accumulatedVolume = json.TradingVolume;
    const volume = accumulatedVolume - currentTradingAccumulatedVolume
    currentTradingAccumulatedVolume = accumulatedVolume;
    currentTradingVolumeTime = tradingVolumeTime;

    insertTickData({ volume, accumulatedVolume, json, commonTableName, connect, verbose })
  });
}

process.on('SIGINT', function() {
  console.log('SIGINT');
  exit();
})

const args = process.argv.slice(2, process.argv.length)
const debug = !!process.env.DEBUG;
const verbose = args[0] === '--verbose'

const commonTableName = process.env.POSTGRES_COMMON_TABLE_NAME;
const ws = initWebSocket();
const { pool, connect } = await initPg({ commonTableName });

(async ({ pool, connect, commonTableName, debug, verbose }) => {
  await main({pool, connect, commonTableName, debug, verbose });
})({ pool, connect, commonTableName, debug, verbose});

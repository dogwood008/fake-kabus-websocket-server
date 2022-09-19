'use strict';

// ref: https://shizenkarasuzon.hatenablog.com/entry/2021/04/21/004132

import WebSocket from 'ws';

// ref: https://stackoverflow.com/q/70306590/15983717
import pg from 'pg';
const { Pool } = pg;
const debug = !!process.env.DEBUG;

function initWebSocket () {
  const protocol = process.env.PROTOCOL;
  const host = process.env.HOST;
  const port = process.env.PORT;
  const path = process.env.WEBSOCKET_PATH || '/';
  const server = `${protocol}://${host}:${port}${path}`;

  console.log(server)
  return new WebSocket(server);
}

function createTableSql(stockCode) {
  return `CREATE TABLE IF NOT EXISTS stock_${stockCode}_raw (
      id SERIAL NOT NULL UNIQUE PRIMARY KEY,
      datetime TIMESTAMP NOT NULL,
      data TEXT NOT NULL
    );`
    + ` CREATE INDEX IF NOT EXISTS stock_${stockCode}_raw_id_index`
    + ` ON stock_${stockCode}_raw (id);`
    + ` CREATE INDEX IF NOT EXISTS stock_${stockCode}_raw_datetime_index`
    + ` ON stock_${stockCode}_raw (datetime);`;
}

function insertSql({ message, stockCode }) {
  if (typeof message === 'undefined') { return }
  const dateTime = message.TradingVolumeTime;
  return `INSERT INTO stock_${stockCode}_raw (datetime, data) VALUES (
    '${dateTime}',
    '${JSON.stringify(message)}'
  );`
}

async function initPg() {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    port: process.env.POSTGRES_PORT,
    database: process.env.POSTGRES_DB_NAME,
  });
  const connect = await pool.connect();

  return { pool, connect };
}

function valuesFromJson(json) {
  const dateTime = json.TradingVolumeTime;
  const volume = json.TradingVolume;
  const price = json.CalcPrice;
  return { dateTime, volume, price };
}

async function exit(connect, pool) {
  await connect.release();
  await pool.end();
}

function stockCodeFromMessage(message) {
  return message.Symbol
}

async function main({ pool, connect, tableCreatedStockCodes }) {
  let currentTradingVolumeTime = null;
  let currentTradingVolume = 0;

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
    if (currentTradingVolumeTime === tradingVolumeTime) {
      return;
    }
    const tradingVolume = json.TradingVolume - currentTradingVolume;
    const stockCode = stockCodeFromMessage(json)
    if(!tableCreatedStockCodes.includes(stockCode)) {
      await createTable(stockCode);
      tableCreatedStockCodes.push(stockCode);
    }

    const sql = insertSql({ message: json, stockCode });
    currentTradingVolume, currentTradingVolumeTime = [tradingVolume, tradingVolumeTime];
    connect.query(sql).then(() => {
      const { dateTime, volume, price } = valuesFromJson(json, stockCode);
      console.log(`[${stockCode}] ${dateTime} ${price} ${volume}` );
    }, (err) => { console.error(err); });
  });
}

async function createTable(stockCode) {
  const sql = createTableSql(stockCode);
  console.log({sql})
  console.log(await connect.query(sql));
}

process.on('SIGINT', function() {
  console.log('SIGINT');
  exit();
})

const ws = initWebSocket();
const { pool, connect } = await initPg();
(async ({ pool, connect, tableCreatedStockCodes }) => {
  const tableCreatedStockCodes = [];
  await main({ pool, connect, tableCreatedStockCodes });
})({ pool, connect });
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

function createDbSql(dbName) {
  return `SELECT 'CREATE DATABASE ${dbName}'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${dbName}'); `
    + `SELECT 'CREATE DATABASE ${dbName}_raw'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${dbName}_raw');`
}

function createTableSql(stockCode) {
  return `CREATE TABLE IF NOT EXISTS stock_${stockCode} (
    datetime timestamp NOT NULL,
    volume int NOT NULL,
    price float NOT NULL
    ); `
    + `CREATE TABLE IF NOT EXISTS stock_${stockCode}_raw (
      datetime timestamp NOT NULL,
      data text NOT NULL
    );`
}

function valuesFromJson(json) {
  const stock_code = '7974';
  const dateTime = json.TradingVolumeTime;
  const volume = json.TradingVolume;
  const price = json.CalcPrice;
  return { stock_code, dateTime, volume, price };
}

function insertSql(message) {
  const { stock_code, dateTime, volume, price } = valuesFromJson(message);
  return `INSERT INTO stock_${stock_code} VALUES(
    '${dateTime}',
    ${volume},
    ${price}
  );`
  + `INSERT INTO stock_${stock_code}_raw VALUES(
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
  });
  const connect = await pool.connect();
  const createDbSqlStatement = createDbSql(process.env.POSTGRES_DB_NAME);
  console.log(createDbSqlStatement)
  await connect.query(createDbSqlStatement);
  for(const stockCode of ['7974']) {
    const sql = createTableSql(stockCode);
    console.log({sql})
    await connect.query(sql);
  }

  return { pool, connect };
}

async function exit(connect, pool) {
  await connect.release();
  await pool.end();
}

async function main({ pool, connect }) {
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

  ws.on('message', function message(data) {
    if (debug) { console.log('%s', data.toString()); }
    const json = JSON.parse(data.toString());
    const tradingVolumeTime = json.TradingVolumeTime;
    if (currentTradingVolumeTime === tradingVolumeTime) {
      return;
    }
    const tradingVolume = json.TradingVolume - currentTradingVolume;
    const sql = insertSql(json);
    currentTradingVolume, currentTradingVolumeTime = [tradingVolume, tradingVolumeTime];
    connect.query(sql).then(() => {
      const { stock_code, dateTime, volume, price } = valuesFromJson(json);
      console.log(`[${stock_code}] ${dateTime} ${price} ${volume}` );
    }, (err) => { console.error(err); });
  });
}

process.on('SIGINT', function() {
  console.log('SIGINT');
  exit();
})

const ws = initWebSocket();
const { pool, connect } = await initPg();
(async ({ pool, connect }) => {
  await main({ pool, connect });
})({ pool, connect });
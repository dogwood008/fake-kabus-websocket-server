'use strict';

import { addSeconds } from 'date-fns'

export class SQLExecuter {
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
    const sql = `
        SELECT * from stock_${stockCode}_raw
          WHERE datetime >= $1
          AND datetime < $2
          ORDER BY id ASC
          LIMIT 10000;`
    console.log(sql, [fromDt, until]);
    return (await client.query(sql, [fromDt, until])).rows;
  }
}

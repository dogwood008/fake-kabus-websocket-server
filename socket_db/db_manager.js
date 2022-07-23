'use strict';

import pg from 'pg';
const { Pool } = pg;

export class DBManager {
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

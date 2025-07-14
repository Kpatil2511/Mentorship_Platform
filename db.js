const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'Patil@1234', // ← replace this
  port: 5432,
});

module.exports = pool;

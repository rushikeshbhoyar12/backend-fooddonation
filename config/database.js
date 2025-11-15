const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'food_donation_db',
  multipleStatements: true
};

let connection;

async function getConnection() {
  if (!connection) {
    connection = await mysql.createConnection(dbConfig);
  }
  return connection;
}

async function executeQuery(query, params = []) {
  try {
    const conn = await getConnection();
    const [rows] = await conn.execute(query, params);
    return rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

module.exports = {
  getConnection,
  executeQuery
};
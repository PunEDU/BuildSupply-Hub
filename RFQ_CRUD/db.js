const mysql = require('mysql2/promise');

function createPool(env = process.env) {
    if (!env.DB_PASSWORD) throw new Error('Set DB_PASSWORD in .env before starting the app.');

    return mysql.createPool({
        host: env.DB_HOST || '127.0.0.1',
        port: Number(env.DB_PORT || 33074),
        database: env.DB_NAME || 'buildsupply_assignment4',
        user: env.DB_USER || 'buildsupply_demo',
        password: env.DB_PASSWORD,
        charset: 'utf8mb4',
        dateStrings: true,
        connectionLimit: 8,
        connectTimeout: 5000,
    });
}

module.exports = { createPool };

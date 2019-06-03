// Update with your config settings.

const dbConnectionConfig = require('./config').db;

let knexConf = {
  client: 'postgresql',
  connection: {
    host: dbConnectionConfig.host,
    port: dbConnectionConfig.port,
    user: dbConnectionConfig.credentials.login,
    password: dbConnectionConfig.credentials.password,
    database: dbConnectionConfig.name
  },
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    tableName: 'migrations',
  },
  ssl: dbConnectionConfig.ssl
};

module.exports = {

  development: knexConf,

  production: knexConf

};

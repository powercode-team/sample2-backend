
const environment = process.env.API_ENVIRONMENT || 'development';

const config = require('../../knexfile.js')[environment];

module.exports = require('knex')(config);

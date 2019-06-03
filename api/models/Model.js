const knex = require('../knex');
const { Model } = require('objection');
const { DbErrors } = require('objection-db-errors');

Model.knex( knex );

class BaseModel extends DbErrors(Model) {

}

module.exports = BaseModel;
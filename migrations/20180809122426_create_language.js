
exports.up = knex => {
  return knex.schema
    .createTable('language', table => {
      table.bigIncrements('language_id').primary();
      table.specificType('language_code', 'varchar(2)').unique().notNullable();
      table.specificType('language_name', 'varchar(100)').unique().notNullable();
      table.unique(['language_name', 'language_code']);
    })
};

exports.down = knex => {
  return knex.schema
    .dropTableIfExists('language')
};
exports.up = function(knex) {
  return knex.schema.alterTable('drivers', (t) => {
    t.decimal('last_lat', 10, 7);
    t.decimal('last_lng', 10, 7);
    t.timestamp('last_location_at');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('drivers', (t) => {
    t.dropColumn('last_lat');
    t.dropColumn('last_lng');
    t.dropColumn('last_location_at');
  });
};

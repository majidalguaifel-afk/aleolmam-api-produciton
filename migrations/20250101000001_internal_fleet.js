exports.up = function(knex) {
  return knex.schema
    .createTable('drivers', (t) => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.string('phone').notNullable();
      t.string('vehicle_info');
      t.boolean('is_active').notNullable().defaultTo(true);
      t.timestamps(true, true);
    })
    .alterTable('shipments', (t) => {
      t.string('assigned_driver_id').references('id').inTable('drivers');
      t.index('assigned_driver_id');
    });
};

exports.down = function(knex) {
  return knex.schema
    .alterTable('shipments', (t) => {
      t.dropColumn('assigned_driver_id');
    })
    .dropTableIfExists('drivers');
};

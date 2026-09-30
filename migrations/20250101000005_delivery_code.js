exports.up = function(knex) {
  return knex.schema.alterTable('shipments', (t) => {
    t.string('delivery_code', 4);
    t.timestamp('delivery_code_sent_at');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('shipments', (t) => {
    t.dropColumn('delivery_code');
    t.dropColumn('delivery_code_sent_at');
  });
};

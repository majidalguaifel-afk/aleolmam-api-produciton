exports.up = function(knex) {
  return knex.schema.createTable('cash_settlements', (t) => {
    t.string('id').primary();
    t.string('driver_id').notNullable().references('id').inTable('drivers').onDelete('CASCADE');
    t.date('settlement_date').notNullable();
    t.decimal('amount', 10, 2).notNullable();
    t.string('settled_by_user_id').references('id').inTable('users');
    t.timestamp('settled_at').defaultTo(knex.fn.now());
    t.unique(['driver_id', 'settlement_date']); // تسوية واحدة فقط لكل مندوب لكل يوم
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('cash_settlements');
};

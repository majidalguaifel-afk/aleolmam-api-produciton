exports.up = function(knex) {
  return knex.schema.alterTable('drivers', (t) => {
    t.string('pin_hash');
    t.string('pin_prefix'); // آخر رقمين يُعرضان في اللوحة للتعرّف السريع فقط (وليس الرمز كاملاً)
    t.timestamp('last_login_at');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('drivers', (t) => {
    t.dropColumn('pin_hash');
    t.dropColumn('pin_prefix');
    t.dropColumn('last_login_at');
  });
};

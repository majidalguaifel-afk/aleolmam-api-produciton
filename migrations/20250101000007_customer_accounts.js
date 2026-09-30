exports.up = function(knex) {
  return knex.schema
    .createTable('customer_accounts', (t) => {
      t.string('id').primary();
      t.string('email').notNullable().unique();
      t.string('phone').notNullable();
      t.boolean('email_verified').defaultTo(false);
      t.timestamp('last_login_at');
      t.timestamps(true, true);
    })
    .createTable('customer_verification_codes', (t) => {
      t.string('id').primary();
      t.string('email').notNullable();
      t.string('code_hash').notNullable();
      t.string('phone'); // يُحفظ مؤقتاً وقت التسجيل الأول، يُنسخ لحساب العميل بعد نجاح التحقق
      t.integer('attempts').defaultTo(0);
      t.timestamp('expires_at').notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('customer_verification_codes')
    .dropTableIfExists('customer_accounts');
};

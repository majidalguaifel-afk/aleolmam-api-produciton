exports.up = function(knex) {
  return knex.schema
    .createTable('users', (t) => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.string('email').unique().notNullable();
      t.string('password_hash').notNullable();
      t.string('role').notNullable().defaultTo('ADMIN'); // SUPER_ADMIN | ADMIN | OPERATOR
      t.timestamps(true, true);
    })
    .createTable('clients', (t) => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.string('contact_email').notNullable();
      t.string('contact_phone');
      t.string('api_key_hash').unique().notNullable();
      t.string('api_key_prefix').notNullable();
      t.string('status').notNullable().defaultTo('ACTIVE'); // ACTIVE | SUSPENDED | PENDING
      t.integer('rate_limit').notNullable().defaultTo(100);
      t.timestamps(true, true);
      t.index('api_key_hash');
    })
    .createTable('carriers', (t) => {
      t.string('id').primary();
      t.string('code').unique().notNullable();
      t.string('name').notNullable();
      t.string('name_ar').notNullable();
      t.boolean('is_active').notNullable().defaultTo(true);
      t.text('config_json');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    })
    .createTable('shipments', (t) => {
      t.string('id').primary();
      t.string('reference').unique().notNullable();
      t.string('client_id').notNullable().references('id').inTable('clients');
      t.string('carrier_id').notNullable().references('id').inTable('carriers');
      t.string('carrier_shipment_id');
      t.string('status').notNullable().defaultTo('PENDING');
      t.string('sender_name').notNullable();
      t.string('sender_phone').notNullable();
      t.string('sender_address').notNullable();
      t.string('sender_city').notNullable();
      t.string('recipient_name').notNullable();
      t.string('recipient_phone').notNullable();
      t.string('recipient_address').notNullable();
      t.string('recipient_city').notNullable();
      t.float('weight_kg').notNullable();
      t.string('package_desc');
      t.float('cod_amount');
      t.float('declared_value');
      t.float('cost');
      t.string('currency').notNullable().defaultTo('SAR');
      t.text('raw_request');
      t.text('raw_response');
      t.timestamps(true, true);
      t.index('client_id');
      t.index('carrier_id');
      t.index('status');
      t.index('carrier_shipment_id');
    })
    .createTable('tracking_events', (t) => {
      t.string('id').primary();
      t.string('shipment_id').notNullable().references('id').inTable('shipments');
      t.string('status').notNullable();
      t.string('description');
      t.string('description_ar');
      t.string('location');
      t.timestamp('occurred_at').defaultTo(knex.fn.now());
      t.string('source').notNullable().defaultTo('carrier');
      t.index('shipment_id');
    })
    .createTable('webhooks', (t) => {
      t.string('id').primary();
      t.string('client_id').notNullable().references('id').inTable('clients');
      t.string('url').notNullable();
      t.string('secret').notNullable();
      t.string('events').notNullable();
      t.boolean('is_active').notNullable().defaultTo(true);
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.index('client_id');
    })
    .createTable('webhook_deliveries', (t) => {
      t.string('id').primary();
      t.string('webhook_id').notNullable().references('id').inTable('webhooks');
      t.string('event').notNullable();
      t.text('payload').notNullable();
      t.integer('status_code');
      t.boolean('success').notNullable().defaultTo(false);
      t.integer('attempt').notNullable().defaultTo(1);
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.index('webhook_id');
    })
    .createTable('audit_logs', (t) => {
      t.string('id').primary();
      t.string('actor_type').notNullable();
      t.string('actor_id');
      t.string('action').notNullable();
      t.text('details');
      t.string('ip');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('audit_logs')
    .dropTableIfExists('webhook_deliveries')
    .dropTableIfExists('webhooks')
    .dropTableIfExists('tracking_events')
    .dropTableIfExists('shipments')
    .dropTableIfExists('carriers')
    .dropTableIfExists('clients')
    .dropTableIfExists('users');
};

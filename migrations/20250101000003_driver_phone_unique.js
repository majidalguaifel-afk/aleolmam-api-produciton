exports.up = async function(knex) {
  // نظّف أي تكرارات قديمة موجودة قبل فرض القيد (يبقي الأحدث فقط، احتياطاً من بيانات اختبار سابقة)
  const dups = await knex('drivers').select('phone').groupBy('phone').havingRaw('count(*) > 1');
  for (const { phone } of dups) {
    const rows = await knex('drivers').where({ phone }).orderBy('created_at', 'desc');
    const idsToRemove = rows.slice(1).map((r) => r.id);
    if (idsToRemove.length) {
      await knex('shipments').whereIn('assigned_driver_id', idsToRemove).update({ assigned_driver_id: rows[0].id });
      await knex('drivers').whereIn('id', idsToRemove).del();
    }
  }
  return knex.schema.alterTable('drivers', (t) => {
    t.unique('phone');
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('drivers', (t) => {
    t.dropUnique('phone');
  });
};

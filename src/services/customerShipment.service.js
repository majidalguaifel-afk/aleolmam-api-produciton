const db = require('../config/db');
const { ApiError } = require('../middleware/errorHandler');

/**
 * شحنات العميل — "وارد" (هو المستلم) أو "صادر" (هو المرسل)، حسب تطابق رقم جواله
 * المسجّل بحسابه مع sender_phone أو recipient_phone بالشحنة.
 * لا نكشف شحنات أي رقم جوال ثاني — البحث دائماً برقم جوال الحساب المُتحقَّق منه فقط.
 */
async function listCustomerShipments(customerPhone, direction) {
  const col = direction === 'outgoing' ? 'sender_phone' : 'recipient_phone';
  return db('shipments')
    .where(col, customerPhone)
    .select('id', 'reference', 'status', 'sender_name', 'sender_city', 'recipient_name', 'recipient_city', 'cod_amount', 'created_at')
    .orderBy('created_at', 'desc');
}

async function getCustomerShipment(customerPhone, shipmentId) {
  const shipment = await db('shipments')
    .where({ id: shipmentId })
    .andWhere((w) => w.where('sender_phone', customerPhone).orWhere('recipient_phone', customerPhone))
    .first();
  if (!shipment) throw new ApiError(404, 'SHIPMENT_NOT_FOUND', 'الشحنة غير موجودة أو غير مرتبطة بحسابك');
  const events = await db('tracking_events').where({ shipment_id: shipmentId }).orderBy('occurred_at', 'asc');
  return { ...shipment, events, direction: shipment.sender_phone === customerPhone ? 'outgoing' : 'incoming' };
}

module.exports = { listCustomerShipments, getCustomerShipment };

const CarrierAdapter = require('../CarrierAdapter');
const { nanoid } = require('nanoid');

/**
 * محوّل وهمي (Mock) — يعمل بالكامل بدون أي اتصال إنترنت أو بيانات اعتماد حقيقية.
 * مثالي لـ: تجربة النظام فوراً، الاختبار التلقائي، العروض التوضيحية للعملاء.
 * لما تصير بيانات اعتماد شركة حقيقية جاهزة، تستبدل carrierFactory بها فقط.
 */
class MockAdapter extends CarrierAdapter {
  async createShipment(shipmentData) {
    const carrierShipmentId = `MOCK-${nanoid(10).toUpperCase()}`;
    const estimatedCost = Math.round((shipmentData.weightKg * 8 + 15) * 100) / 100;
    return {
      carrierShipmentId,
      cost: estimatedCost,
      currency: 'SAR',
      rawResponse: { simulated: true, message: 'تم إنشاء شحنة وهمية بنجاح (Mock)', carrierShipmentId },
    };
  }

  async getTracking({ carrierShipmentId }) {
    // نولّد تسلسل أحداث وهمي منطقي بناءً على الوقت الحالي، لغرض العرض التوضيحي
    const now = Date.now();
    const events = [
      { status: 'CREATED', description: 'Shipment created', descriptionAr: 'تم إنشاء الشحنة', location: 'الرياض', occurredAt: new Date(now - 3600 * 1000 * 5).toISOString() },
      { status: 'PICKED_UP', description: 'Picked up from sender', descriptionAr: 'تم استلام الشحنة من المرسل', location: 'الرياض', occurredAt: new Date(now - 3600 * 1000 * 3).toISOString() },
      { status: 'IN_TRANSIT', description: 'In transit to destination hub', descriptionAr: 'الشحنة في الطريق لمركز الفرز', location: 'مركز فرز الرياض', occurredAt: new Date(now - 3600 * 1000).toISOString() },
    ];
    return { status: 'IN_TRANSIT', events };
  }

  async cancelShipment(carrierShipmentId) {
    return { cancelled: true, rawResponse: { simulated: true, carrierShipmentId, message: 'تم إلغاء الشحنة الوهمية' } };
  }

  normalizeStatus(carrierStatus) {
    const map = {
      CREATED: 'CREATED',
      PICKED_UP: 'PICKED_UP',
      IN_TRANSIT: 'IN_TRANSIT',
      OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
      DELIVERED: 'DELIVERED',
      CANCELLED: 'CANCELLED',
    };
    return map[carrierStatus] || 'IN_TRANSIT';
  }
}

module.exports = MockAdapter;

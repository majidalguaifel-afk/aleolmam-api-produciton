const CarrierAdapter = require('../CarrierAdapter');
const db = require('../../config/db');

/**
 * ============================================================================
 * محوّل الأسطول الداخلي (Internal Fleet Adapter)
 * ============================================================================
 * يُستخدم هذا المحوّل عندما تكون شركة الإلمام نفسها هي من ستوصّل الشحنة
 * (بمناديبها الخاصين)، وليس شركة شحن خارجية.
 *
 * مثال واقعي: شركة "أوتو" (أو أي منصة/تاجر) تُنشئ شحنة عبر واجهة الإلمام
 * وتختار carrierCode = "internal" — فهذا يعني: "وصّلها أنتم بمندوبكم"،
 * بعكس carrierCode = "aramex" الذي يعني "أرسلها لأرامكس ليوصّلوها".
 *
 * الفرق الجوهري عن المحوّلات الأخرى:
 *   - createShipment(): لا يتصل بأي API خارجي، فقط يُبقي الشحنة بحالة PENDING
 *     بانتظار تعيين مندوب من لوحة الإدارة (dispatch)
 *   - getTracking(): لا يستعلم من أي جهة خارجية، بل يقرأ من جدول tracking_events
 *     نفسه — لأن التحديثات هنا تُدخَل يدوياً من طرف الإلمام (عبر مسارات
 *     /api/v1/internal/*) وليست مسحوبة من API خارجي
 *   - cancelShipment(): إلغاء محلي فقط
 * ============================================================================
 */
class InternalAdapter extends CarrierAdapter {
  async createShipment(shipmentData) {
    // لا إرسال خارجي — الشحنة تبقى بانتظار تعيين مندوب من الإدارة
    return {
      carrierShipmentId: null, // يُملأ لاحقاً إن رغبتم بربطه برقم داخلي عند التعيين
      cost: null,
      currency: 'SAR',
      rawResponse: { internal: true, message: 'بانتظار تعيين مندوب من فريق الإلمام' },
    };
  }

  async getTracking({ shipmentId }) {
    // نقرأ من جدول التتبع نفسه بدل استدعاء API خارجي
    const events = await db('tracking_events')
      .where({ shipment_id: shipmentId })
      .orderBy('occurred_at', 'asc');

    const formatted = events.map((e) => ({
      status: e.status,
      description: e.description,
      descriptionAr: e.description_ar,
      location: e.location,
      occurredAt: e.occurred_at,
    }));

    const latest = formatted[formatted.length - 1];
    return { status: latest?.status || 'PENDING', events: formatted };
  }

  async cancelShipment() {
    // لا يوجد جهة خارجية لإبلاغها — الإلغاء يتم محلياً فقط في shipment.service.js
    return { cancelled: true, rawResponse: { internal: true } };
  }

  normalizeStatus(status) {
    return status; // الحالات هنا موحّدة أصلاً لأنها تُكتب يدوياً بنفس enum النظام
  }
}

module.exports = InternalAdapter;

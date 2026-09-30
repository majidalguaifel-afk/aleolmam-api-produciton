/**
 * ============================================================================
 * طبقة تجريد الربط مع شركات الشحن (Carrier Integration Abstraction Layer)
 * ============================================================================
 * أي شركة شحن جديدة (أرامكس، سمسا، سبل، أو أي شركة مستقبلية) يجب أن تُنفّذ
 * هذه الدوال الأربع بالضبط. هذا يضمن أن باقي النظام (المتحكمات، الخدمات)
 * يتعامل مع كل شركات الشحن بنفس الطريقة تماماً، بدون أي تعديل عند إضافة
 * شركة جديدة — فقط أضف ملف Adapter جديد وسجّله في carrierFactory.js
 *
 * كل دالة يجب أن ترجع بصيغة موحّدة (Unified Format) بغض النظر عن شكل رد
 * شركة الشحن الفعلي، وهذا هو جوهر "طبقة التجريد" المطلوبة.
 * ============================================================================
 */
class CarrierAdapter {
  /**
   * ينشئ شحنة جديدة لدى شركة الشحن
   * @param {object} shipmentData - بيانات موحّدة من نظام الإلمام
   * @returns {Promise<{carrierShipmentId: string, cost: number|null, currency: string, rawResponse: object, labelUrl?: string}>}
   */
  async createShipment(shipmentData) {
    throw new Error('createShipment() لم يتم تنفيذها في هذا الـ Adapter');
  }

  /**
   * يستعلم عن حالة/تتبع شحنة موجودة
   * @param {{carrierShipmentId: string|null, shipmentId: string}} ids - يُمرَّر الاثنان دائماً؛
   *   المحوّلات الخارجية (أرامكس/سمسا/سبل) تستخدم carrierShipmentId للاستعلام من API الشركة،
   *   بينما المحوّل الداخلي (InternalAdapter) يستخدم shipmentId لقراءة سجل التتبع من قاعدتنا مباشرة.
   * @returns {Promise<{status: string, events: Array<{status:string, description:string, location:string, occurredAt:string}>}>}
   */
  async getTracking(ids) {
    throw new Error('getTracking() لم يتم تنفيذها في هذا الـ Adapter');
  }

  /**
   * يلغي شحنة لدى شركة الشحن (إن كان ذلك مدعوماً من الشركة)
   * @param {string} carrierShipmentId
   * @returns {Promise<{cancelled: boolean, rawResponse: object}>}
   */
  async cancelShipment(carrierShipmentId) {
    throw new Error('cancelShipment() لم يتم تنفيذها في هذا الـ Adapter');
  }

  /**
   * يترجم حالة شركة الشحن الخاصة (نصوص/أكواد مختلفة لكل شركة) إلى
   * حالة موحّدة يفهمها نظام الإلمام بالكامل (انظر enum ShipmentStatus)
   * @param {string} carrierStatus
   * @returns {string} أحد قيم: PENDING|CREATED|PICKED_UP|IN_TRANSIT|OUT_FOR_DELIVERY|DELIVERED|FAILED|CANCELLED|RETURNED
   */
  normalizeStatus(carrierStatus) {
    return 'IN_TRANSIT';
  }
}

module.exports = CarrierAdapter;

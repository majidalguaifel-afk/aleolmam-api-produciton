const axios = require('axios');
const CarrierAdapter = require('../CarrierAdapter');
const logger = require('../../config/logger');

/**
 * ============================================================================
 * محوّل البريد السعودي / سبل (Saudi Post — SPL Business API)
 * ============================================================================
 * ⚠️ قالب جاهز للتفعيل بعد استلام بيانات اعتماد حساب أعمال سبل الرسمي.
 * راجع بوابة أعمال البريد السعودي أو مدير حسابكم لديهم للحصول على:
 *   - رابط الـ API ومفتاح الوصول
 *   - رقم الحساب التجاري (Business Account Number)
 * ============================================================================
 */
class SaudiPostAdapter extends CarrierAdapter {
  constructor(config = {}) {
    super();
    this.baseUrl = config.baseUrl || '';
    this.apiKey = config.apiKey || '';
  }

  _ensureConfigured() {
    if (!this.baseUrl || !this.apiKey) {
      const err = new Error('بيانات اعتماد سبل (البريد السعودي) غير مُدخلة بعد — أدخلها من لوحة التحكم ← شركات الشحن ← سبل');
      err.statusCode = 424;
      err.code = 'CARRIER_NOT_CONFIGURED';
      throw err;
    }
  }

  async createShipment(shipmentData) {
    this._ensureConfigured();
    // TODO: تأكيد شكل الحمولة الدقيق من توثيق سبل الرسمي عند التفعيل
    const payload = {
      sender: {
        name: shipmentData.senderName,
        phone: shipmentData.senderPhone,
        address: shipmentData.senderAddress,
        city: shipmentData.senderCity,
      },
      receiver: {
        name: shipmentData.recipientName,
        phone: shipmentData.recipientPhone,
        address: shipmentData.recipientAddress,
        city: shipmentData.recipientCity,
      },
      weightKg: shipmentData.weightKg,
      codAmount: shipmentData.codAmount || 0,
    };

    try {
      const { data } = await axios.post(`${this.baseUrl}/shipments`, payload, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        timeout: 15000,
      });

      return {
        carrierShipmentId: data.trackingNumber,
        cost: data.cost ?? null,
        currency: 'SAR',
        rawResponse: data,
      };
    } catch (err) {
      logger.error(`SaudiPost createShipment failed: ${err.message}`);
      throw err;
    }
  }

  async getTracking({ carrierShipmentId }) {
    this._ensureConfigured();
    try {
      const { data } = await axios.get(`${this.baseUrl}/shipments/${carrierShipmentId}/tracking`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        timeout: 15000,
      });
      const events = (data?.events || []).map((e) => ({
        status: e.status,
        description: e.description,
        descriptionAr: e.descriptionAr || e.description,
        location: e.location,
        occurredAt: e.timestamp,
      }));
      const latest = events[events.length - 1];
      return { status: this.normalizeStatus(latest?.status), events };
    } catch (err) {
      logger.error(`SaudiPost getTracking failed: ${err.message}`);
      throw err;
    }
  }

  async cancelShipment(carrierShipmentId) {
    this._ensureConfigured();
    try {
      const { data } = await axios.post(
        `${this.baseUrl}/shipments/${carrierShipmentId}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${this.apiKey}` }, timeout: 15000 }
      );
      return { cancelled: !!data?.success, rawResponse: data };
    } catch (err) {
      logger.error(`SaudiPost cancelShipment failed: ${err.message}`);
      throw err;
    }
  }

  normalizeStatus(carrierStatus) {
    const map = {
      created: 'CREATED',
      picked_up: 'PICKED_UP',
      in_transit: 'IN_TRANSIT',
      out_for_delivery: 'OUT_FOR_DELIVERY',
      delivered: 'DELIVERED',
      returned: 'RETURNED',
    };
    return map[String(carrierStatus).toLowerCase()] || 'IN_TRANSIT';
  }
}

module.exports = SaudiPostAdapter;

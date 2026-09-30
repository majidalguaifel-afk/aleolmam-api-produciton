const axios = require('axios');
const CarrierAdapter = require('../CarrierAdapter');
const logger = require('../../config/logger');

/**
 * ============================================================================
 * محوّل سمسا (SMSA Express API)
 * ============================================================================
 * ⚠️ قالب جاهز للتفعيل بعد استلام بيانات اعتماد "SMSA Business API" الرسمية:
 *   - API Key (تُعطى عند تفعيل حساب أعمال SMSA)
 *   - Password / رقم الحساب التجاري
 *   - رابط بيئة الاختبار (Sandbox) ثم بيئة الإنتاج
 * راجع: https://smsaexpress.com (قسم الأعمال / API) أو مدير حسابكم لديهم.
 * ============================================================================
 */
class SmsaAdapter extends CarrierAdapter {
  constructor(config = {}) {
    super();
    this.baseUrl = config.baseUrl || '';
    this.apiKey = config.apiKey || '';
    this.password = config.password || '';
  }

  _ensureConfigured() {
    if (!this.baseUrl || !this.apiKey) {
      const err = new Error('بيانات اعتماد سمسا غير مُدخلة بعد — أدخلها من لوحة التحكم ← شركات الشحن ← سمسا');
      err.statusCode = 424;
      err.code = 'CARRIER_NOT_CONFIGURED';
      throw err;
    }
  }

  async createShipment(shipmentData) {
    this._ensureConfigured();

    // TODO: تأكيد شكل الحمولة الدقيق (Request Body) من توثيق SMSA Business API الرسمي
    const payload = {
      apiKey: this.apiKey,
      password: this.password,
      consigneeName: shipmentData.recipientName,
      consigneePhone: shipmentData.recipientPhone,
      consigneeAddress: shipmentData.recipientAddress,
      consigneeCity: shipmentData.recipientCity,
      shipperName: shipmentData.senderName,
      shipperPhone: shipmentData.senderPhone,
      shipperAddress: shipmentData.senderAddress,
      shipperCity: shipmentData.senderCity,
      weight: shipmentData.weightKg,
      codAmount: shipmentData.codAmount || 0,
      description: shipmentData.packageDesc || 'Parcel',
    };

    try {
      const { data } = await axios.post(`${this.baseUrl}/AddShipment`, payload, { timeout: 15000 });

      if (!data?.awbNumber) {
        throw new Error(data?.message || 'فشل إنشاء الشحنة لدى سمسا');
      }

      return {
        carrierShipmentId: data.awbNumber,
        cost: data.cost ?? null,
        currency: 'SAR',
        rawResponse: data,
        labelUrl: data.labelUrl,
      };
    } catch (err) {
      logger.error(`SMSA createShipment failed: ${err.message}`);
      throw err;
    }
  }

  async getTracking({ carrierShipmentId }) {
    this._ensureConfigured();
    try {
      // TODO: تأكيد مسار التتبع الرسمي من توثيق SMSA
      const { data } = await axios.get(`${this.baseUrl}/Track/${carrierShipmentId}`, {
        params: { apiKey: this.apiKey },
        timeout: 15000,
      });

      const events = (data?.events || []).map((e) => ({
        status: e.statusCode,
        description: e.statusDescription,
        descriptionAr: e.statusDescriptionAr || e.statusDescription,
        location: e.city,
        occurredAt: e.dateTime,
      }));

      const latest = events[events.length - 1];
      return { status: this.normalizeStatus(latest?.status), events };
    } catch (err) {
      logger.error(`SMSA getTracking failed: ${err.message}`);
      throw err;
    }
  }

  async cancelShipment(carrierShipmentId) {
    this._ensureConfigured();
    try {
      const { data } = await axios.post(
        `${this.baseUrl}/CancelShipment`,
        { apiKey: this.apiKey, awbNumber: carrierShipmentId },
        { timeout: 15000 }
      );
      return { cancelled: !!data?.success, rawResponse: data };
    } catch (err) {
      logger.error(`SMSA cancelShipment failed: ${err.message}`);
      throw err;
    }
  }

  normalizeStatus(carrierStatus) {
    // TODO: استكمال الخريطة الكاملة حسب أكواد سمسا الرسمية
    const map = {
      '1': 'CREATED',
      '2': 'PICKED_UP',
      '3': 'IN_TRANSIT',
      '4': 'OUT_FOR_DELIVERY',
      '5': 'DELIVERED',
      '6': 'RETURNED',
    };
    return map[String(carrierStatus)] || 'IN_TRANSIT';
  }
}

module.exports = SmsaAdapter;

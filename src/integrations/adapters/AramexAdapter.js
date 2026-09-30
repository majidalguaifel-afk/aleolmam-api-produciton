const axios = require('axios');
const CarrierAdapter = require('../CarrierAdapter');
const logger = require('../../config/logger');

/**
 * ============================================================================
 * محوّل أرامكس (Aramex Shipping API)
 * ============================================================================
 * ⚠️ هذا القالب مبني على البنية العامة المعروفة لواجهة أرامكس (Shipping API v2)،
 * لكنه يحتاج التأكيد والتفعيل النهائي بعد استلام شركة الإلمام لحساب أرامكس
 * تجاري رسمي والحصول على:
 *   - Username / Password (بيانات دخول حساب API، تختلف عن حساب الموقع العادي)
 *   - Account Number / PIN / Entity / Country Code
 *   - رابط الـ API الرسمي (Sandbox للتجربة، ثم Production)
 *
 * راجع التوثيق الرسمي لأرامكس قبل التفعيل النهائي:
 * https://www.aramex.com/developers
 *
 * كل القيم الحساسة تُقرأ من متغيرات البيئة (.env) ولا تُكتب هنا مباشرة أبداً.
 * ============================================================================
 */
class AramexAdapter extends CarrierAdapter {
  constructor(config = {}) {
    super();
    // الإعدادات تأتي من لوحة التحكم (محفوظة ومشفّرة) مع احتياط متغيرات البيئة — انظر carrierConfig.service.js
    this.baseUrl = config.baseUrl || '';
    this.credentials = {
      UserName: config.username || '',
      Password: config.password || '',
      Version: 'v1',
      AccountNumber: config.accountNumber || '',
      AccountPin: config.accountPin || '',
      AccountEntity: config.accountEntity || '',
      AccountCountryCode: config.accountCountryCode || 'SA',
    };
  }

  _ensureConfigured() {
    if (!this.baseUrl || !this.credentials.UserName) {
      const err = new Error(
        'بيانات اعتماد أرامكس غير مُدخلة بعد. أدخلها من لوحة التحكم ← شركات الشحن ← أرامكس، ' +
        'بعد استلامها من أرامكس.'
      );
      err.statusCode = 424; // Failed Dependency
      err.code = 'CARRIER_NOT_CONFIGURED';
      throw err;
    }
  }

  async createShipment(shipmentData) {
    this._ensureConfigured();

    const payload = {
      ClientInfo: this.credentials,
      Shipments: [
        {
          Shipper: {
            PartyAddress: { Line1: shipmentData.senderAddress, City: shipmentData.senderCity, CountryCode: 'SA' },
            Contact: { PersonName: shipmentData.senderName, PhoneNumber1: shipmentData.senderPhone },
          },
          Consignee: {
            PartyAddress: { Line1: shipmentData.recipientAddress, City: shipmentData.recipientCity, CountryCode: 'SA' },
            Contact: { PersonName: shipmentData.recipientName, PhoneNumber1: shipmentData.recipientPhone },
          },
          Details: {
            ActualWeight: { Unit: 'KG', Value: shipmentData.weightKg },
            ProductGroup: 'DOM',
            ProductType: 'ONP',
            PaymentType: shipmentData.codAmount ? 'C' : 'P', // C = Cash on Delivery
            CashOnDeliveryAmount: shipmentData.codAmount
              ? { CurrencyCode: 'SAR', Value: shipmentData.codAmount }
              : undefined,
            DescriptionOfGoods: shipmentData.packageDesc || 'Parcel',
          },
        },
      ],
    };

    try {
      // TODO: تأكيد المسار الدقيق (endpoint) من توثيق أرامكس الرسمي وقت التفعيل
      const { data } = await axios.post(`${this.baseUrl}/Shipping/Shipments/Create`, payload, {
        timeout: 15000,
      });

      const shipment = data?.Shipments?.[0];
      if (!shipment || shipment.HasErrors) {
        throw new Error(shipment?.Notifications?.[0]?.Message || 'فشل إنشاء الشحنة لدى أرامكس');
      }

      return {
        carrierShipmentId: shipment.ID,
        cost: shipment.ShipmentAmount?.Value ?? null,
        currency: shipment.ShipmentAmount?.CurrencyCode || 'SAR',
        rawResponse: data,
        labelUrl: shipment.ShipmentLabel?.LabelURL,
      };
    } catch (err) {
      logger.error(`Aramex createShipment failed: ${err.message}`);
      throw err;
    }
  }

  async getTracking({ carrierShipmentId }) {
    this._ensureConfigured();
    try {
      // TODO: تأكيد مسار التتبع الرسمي (TrackShipments) من توثيق أرامكس
      const { data } = await axios.post(
        `${this.baseUrl}/Tracking/Shipments/TrackShipments`,
        { ClientInfo: this.credentials, Shipments: [carrierShipmentId] },
        { timeout: 15000 }
      );

      const results = data?.TrackingResults?.[0]?.Value || [];
      const events = results.map((r) => ({
        status: r.UpdateCode,
        description: r.UpdateDescription,
        descriptionAr: r.UpdateDescription,
        location: r.UpdateLocation,
        occurredAt: r.UpdateDateTime,
      }));

      const latest = events[events.length - 1];
      return { status: this.normalizeStatus(latest?.status), events };
    } catch (err) {
      logger.error(`Aramex getTracking failed: ${err.message}`);
      throw err;
    }
  }

  async cancelShipment(carrierShipmentId) {
    // ملاحظة: أرامكس لا تدعم إلغاء الشحنة عبر API بعد جدولة الاستلام في كثير من الحالات —
    // يُنصح بالتحقق من سياسة الإلغاء الفعلية معهم، وقد يتطلب اتصالاً يدوياً بخدمة العملاء.
    const err = new Error('إلغاء الشحنات عبر API غير مدعوم رسمياً من أرامكس لكل الحالات — تحقق يدوياً');
    err.statusCode = 501;
    err.code = 'CANCEL_NOT_SUPPORTED';
    throw err;
  }

  normalizeStatus(carrierStatus) {
    // TODO: استكمال الخريطة الكاملة حسب أكواد أرامكس الرسمية (SH197, SH005, ...)
    const map = {
      SH001: 'CREATED',
      SH005: 'PICKED_UP',
      SH197: 'IN_TRANSIT',
      SH380: 'OUT_FOR_DELIVERY',
      SH021: 'DELIVERED',
    };
    return map[carrierStatus] || 'IN_TRANSIT';
  }
}

module.exports = AramexAdapter;

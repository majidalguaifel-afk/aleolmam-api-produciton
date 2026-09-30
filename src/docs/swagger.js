const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Al-Elmam Logistics API — واجهة برمجة تطبيقات الإلمام للخدمات اللوجستية',
      version: '1.1.0',
      description: `
واجهة برمجية موحّدة لإدارة شحنات شركة الإلمام للخدمات اللوجستية.

**نوعان من الاستخدام:**
1. **عملاء خارجيون** (تجار، منصات، شركات مثل "أوتو"): يستخدمون \`X-API-Key\` لإنشاء ومتابعة شحنات — إما تُرسَل لشركة شحن خارجية (أرامكس/سمسا/سبل)، أو تُسنَد لأسطول الإلمام الداخلي (carrierCode = "internal").
2. **فريق الإلمام الإداري**: يستخدم تسجيل دخول JWT لإدارة العملاء، المناديب، وتعيين الشحنات الداخلية.

لإدارة النظام بدون كتابة أي كود، استخدم **لوحة التحكم** على المسار \`/admin\` (تنشئ منها العملاء والمفاتيح وتوزّع الشحنات وتربط شركات الشحن).

جميع التواريخ بصيغة ISO 8601. جميع المبالغ بالريال السعودي (SAR) ما لم يُذكر خلاف ذلك.
      `,
      contact: { name: 'فريق تقنية المعلومات — شركة الإلمام' },
    },
    servers: [
      { url: 'https://api.alelmam.com', description: 'بيئة الإنتاج' },
      { url: 'http://localhost:4000', description: 'بيئة التطوير المحلي' },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'مفتاح API الخاص بحسابك (يُعطى عند إنشاء حسابك من فريق الإلمام)',
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'رمز دخول لوحة إدارة الإلمام (لفريق الإلمام الداخلي فقط)',
        },
      },
      schemas: {
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'admin@alelmam.com' },
            password: { type: 'string', example: 'SecurePass123' },
          },
        },
        CreateShipmentRequest: {
          type: 'object',
          required: ['carrierCode', 'senderName', 'senderPhone', 'senderAddress', 'senderCity', 'recipientName', 'recipientPhone', 'recipientAddress', 'recipientCity', 'weightKg'],
          properties: {
            carrierCode: { type: 'string', example: 'internal', description: '"internal" لأسطول الإلمام، أو "aramex" / "smsa" / "saudipost" لشركة شحن خارجية' },
            senderName: { type: 'string', example: 'متجر الأمثلة' },
            senderPhone: { type: 'string', example: '0512345678' },
            senderAddress: { type: 'string', example: 'شارع الملك فهد، مبنى 12' },
            senderCity: { type: 'string', example: 'الرياض' },
            recipientName: { type: 'string', example: 'أحمد العتيبي' },
            recipientPhone: { type: 'string', example: '0567891234' },
            recipientAddress: { type: 'string', example: 'حي النرجس، شارع الأمير سلطان' },
            recipientCity: { type: 'string', example: 'الرياض' },
            weightKg: { type: 'number', example: 2.5 },
            packageDesc: { type: 'string', example: 'إلكترونيات' },
            codAmount: { type: 'number', example: 150, description: 'مبلغ الدفع عند الاستلام (اختياري)' },
            declaredValue: { type: 'number', example: 300 },
          },
        },
        RegisterWebhookRequest: {
          type: 'object',
          required: ['url', 'events'],
          properties: {
            url: { type: 'string', example: 'https://your-system.com/webhooks/alelmam' },
            events: {
              type: 'array',
              items: { type: 'string', enum: ['shipment.created', 'shipment.status_changed', 'shipment.cancelled', '*'] },
              example: ['shipment.status_changed'],
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);

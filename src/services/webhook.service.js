const crypto = require('crypto');
const axios = require('axios');
const db = require('../config/db');
const { generateId } = require('../utils/id');
const logger = require('../config/logger');

/**
 * يوقّع حمولة الويب هوك بـ HMAC-SHA256 باستخدام سر كل عميل،
 * حتى يتأكد العميل المستقبِل أن الإشعار فعلاً صادر من نظام الإلمام.
 */
function signPayload(secret, payload) {
  return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
}

/**
 * يُرسل حدثاً لكل الويب هوكس المفعّلة والمشتركة في هذا الحدث لعميل معيّن.
 * لا يوقف تنفيذ العملية الأساسية أبداً حتى لو فشل الإرسال (يُسجَّل فقط).
 */
async function dispatchEvent(clientId, eventName, data) {
  const webhooks = await db('webhooks').where({ client_id: clientId, is_active: true });

  for (const webhook of webhooks) {
    const subscribedEvents = webhook.events.split(',').map((e) => e.trim());
    if (!subscribedEvents.includes(eventName) && !subscribedEvents.includes('*')) continue;

    const payload = { event: eventName, timestamp: new Date().toISOString(), data };
    const signature = signPayload(webhook.secret, payload);

    try {
      const response = await axios.post(webhook.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Alelmam-Signature': signature,
          'X-Alelmam-Event': eventName,
        },
        timeout: 8000,
      });
      await logDelivery(webhook.id, eventName, payload, response.status, true);
    } catch (err) {
      const statusCode = err.response?.status || null;
      logger.warn(`فشل إرسال ويب هوك (${eventName}) إلى ${webhook.url}: ${err.message}`);
      await logDelivery(webhook.id, eventName, payload, statusCode, false);
      // TODO: يمكن إضافة نظام إعادة محاولة (retry queue) لاحقاً — مثال: bull/bullmq مع Redis
    }
  }
}

async function logDelivery(webhookId, event, payload, statusCode, success) {
  await db('webhook_deliveries').insert({
    id: generateId('whd'),
    webhook_id: webhookId,
    event,
    payload: JSON.stringify(payload),
    status_code: statusCode,
    success,
    attempt: 1,
  });
}

async function registerWebhook(clientId, { url, events }) {
  const id = generateId('wh');
  const secret = crypto.randomBytes(24).toString('hex');
  await db('webhooks').insert({
    id,
    client_id: clientId,
    url,
    secret,
    events: Array.isArray(events) ? events.join(',') : events,
  });
  return db('webhooks').where({ id }).first();
}

async function listWebhooks(clientId) {
  return db('webhooks').where({ client_id: clientId }).select('id', 'url', 'events', 'is_active', 'created_at');
}

async function deleteWebhook(clientId, webhookId) {
  const deleted = await db('webhooks').where({ id: webhookId, client_id: clientId }).del();
  return deleted > 0;
}

module.exports = { dispatchEvent, registerWebhook, listWebhooks, deleteWebhook, signPayload };

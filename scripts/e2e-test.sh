#!/bin/bash
set -e
cd /home/claude/alelmam-api
BASE="http://localhost:4000"

echo "===== 1) تسجيل دخول الإدارة ====="
LOGIN=$(curl -s -X POST $BASE/api/v1/auth/login -H "Content-Type: application/json" \
  -d '{"email":"admin@alelmam.com","password":"ChangeMe123!"}')
echo "$LOGIN" | jq .
TOKEN=$(echo "$LOGIN" | jq -r '.data.token')
echo "JWT: ${TOKEN:0:30}..."

echo -e "\n===== 2) إنشاء عميل API جديد (يمثّل شركة أوتو) ====="
CLIENT=$(curl -s -X POST $BASE/api/v1/auth/admin/clients -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"شركة أوتو","contactEmail":"ops@auto.com","rateLimit":500}')
echo "$CLIENT" | jq .
API_KEY=$(echo "$CLIENT" | jq -r '.data.apiKey')
echo "API KEY: $API_KEY"

echo -e "\n===== 3) اختبار رفض الطلب بدون مفتاح API ====="
curl -s -X GET $BASE/api/v1/shipments | jq .

echo -e "\n===== 4) إنشاء شحنة داخلية (carrierCode=internal) — سيناريو أوتو ====="
SHIPMENT=$(curl -s -X POST $BASE/api/v1/shipments -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "carrierCode":"internal",
    "senderName":"متجر أوتو - فرع الرياض",
    "senderPhone":"0512345678",
    "senderAddress":"شارع الملك فهد",
    "senderCity":"الرياض",
    "recipientName":"أحمد العتيبي",
    "recipientPhone":"0567891234",
    "recipientAddress":"حي النرجس",
    "recipientCity":"الرياض",
    "weightKg":2.5,
    "packageDesc":"طلب من متجر أوتو",
    "codAmount":150
  }')
echo "$SHIPMENT" | jq .
SHIPMENT_ID=$(echo "$SHIPMENT" | jq -r '.data.id')
echo "Shipment ID: $SHIPMENT_ID"

echo -e "\n===== 5) اختبار التحقق من صحة البيانات (رقم جوال خاطئ) ====="
curl -s -X POST $BASE/api/v1/shipments -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"carrierCode":"internal","senderName":"test","senderPhone":"123","senderAddress":"a","senderCity":"a","recipientName":"a","recipientPhone":"0567891234","recipientAddress":"a","recipientCity":"a","weightKg":1}' | jq .

echo -e "\n===== 6) إنشاء شحنة عبر شركة خارجية وهمية (carrierCode=mock) ====="
MOCK_SHIPMENT=$(curl -s -X POST $BASE/api/v1/shipments -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "carrierCode":"mock",
    "senderName":"متجر أوتو","senderPhone":"0512345678","senderAddress":"شارع الملك فهد","senderCity":"الرياض",
    "recipientName":"سارة القحطاني","recipientPhone":"0598765432","recipientAddress":"حي الملقا","recipientCity":"الرياض",
    "weightKg":1.2
  }')
echo "$MOCK_SHIPMENT" | jq .

echo -e "\n===== 7) قائمة شحنات هذا العميل ====="
curl -s -X GET "$BASE/api/v1/shipments?page=1&pageSize=10" -H "X-API-Key: $API_KEY" | jq .

echo -e "\n===== 8) إنشاء مندوب جديد (إدارة الإلمام) ====="
DRIVER=$(curl -s -X POST $BASE/api/v1/internal/drivers -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"خالد المطيري","phone":"05'"$(date +%s%N | tail -c 9)"'","vehicleInfo":"تويوتا هايلكس"}')
echo "$DRIVER" | jq .
DRIVER_ID=$(echo "$DRIVER" | jq -r '.data.id')

echo -e "\n===== 9) شحنات الأسطول الداخلي غير المُعيَّنة (إدارة الإلمام) ====="
curl -s -X GET "$BASE/api/v1/internal/shipments?unassigned=true" -H "Authorization: Bearer $TOKEN" | jq .

echo -e "\n===== 10) تعيين المندوب للشحنة الداخلية ====="
curl -s -X POST "$BASE/api/v1/internal/shipments/$SHIPMENT_ID/assign" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"driverId\":\"$DRIVER_ID\"}" | jq .

echo -e "\n===== 11) تحديث حالة الشحنة يدوياً (تم الاستلام) ====="
curl -s -X POST "$BASE/api/v1/internal/shipments/$SHIPMENT_ID/status" -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"PICKED_UP","descriptionAr":"استلم المندوب الشحنة من المتجر","location":"الرياض"}' | jq .

echo -e "\n===== 12) عرض سجل تتبع الشحنة (كعميل API) ====="
curl -s -X GET "$BASE/api/v1/shipments/$SHIPMENT_ID/tracking" -H "X-API-Key: $API_KEY" | jq .

echo -e "\n===== 13) تسجيل ويب هوك للعميل ====="
curl -s -X POST $BASE/api/v1/webhooks -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"url":"https://example.com/webhook","events":["shipment.status_changed"]}' | jq .

echo -e "\n===== 14) قائمة شركات الشحن المتاحة ====="
curl -s -X GET $BASE/api/v1/carriers -H "X-API-Key: $API_KEY" | jq .

echo -e "\n===== 15) التحقق من توثيق Swagger ====="
curl -s $BASE/api-docs.json | jq '.info, (.paths | keys)'

echo -e "\n✅ انتهى الاختبار الشامل"

const { customAlphabet } = require('nanoid');

const nano = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

// مثال: ALM-7F3K9QX2
function generateShipmentReference() {
  return `ALM-${nano()}`;
}

module.exports = { generateShipmentReference };

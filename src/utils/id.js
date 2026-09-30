const { nanoid } = require('nanoid');

function generateId(prefix = '') {
  return prefix ? `${prefix}_${nanoid(20)}` : nanoid(24);
}

module.exports = { generateId };

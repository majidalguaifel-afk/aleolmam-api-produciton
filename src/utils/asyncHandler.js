// يلف أي دالة مسار async ويمرر أي خطأ لـ Express error handler تلقائياً
// بدل ما نكرر try/catch في كل controller
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;

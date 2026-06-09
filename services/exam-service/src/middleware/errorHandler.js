function errorHandler(error, req, res, next) {
  console.error(error);

  return res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Exam Service hatası.',
  });
}

module.exports = errorHandler;
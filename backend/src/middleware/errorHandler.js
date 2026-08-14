// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  const message = status === 500 ? 'Внутренняя ошибка сервера' : err.message;
  res.status(status).json({ error: message });
}

module.exports = { errorHandler };

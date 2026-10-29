const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode =
    Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : Number.isInteger(err.status) && err.status >= 400 && err.status < 600
        ? err.status
        : 500;
  const requestId = req.id || 'unknown';
  if (statusCode >= 500) {
    console.error('[request.error]', {
      requestId,
      method: req.method,
      path: req.originalUrl,
      error: err.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    });
  }
  const response = {
    success: false,
    message:
      statusCode >= 500
        ? 'Internal Server Error'
        : err.type === 'entity.too.large'
          ? 'Request payload is too large'
          : err.type === 'entity.parse.failed'
            ? 'Malformed request body'
            : err.message || 'Request failed',
    requestId,
  };

  if (process.env.NODE_ENV !== 'production' && err.details) {
    response.details = err.details;
  }

  return res.status(statusCode).json(response);
};

export default errorHandler;

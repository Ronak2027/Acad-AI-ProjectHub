const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  // Check if it's an Express-validator error
  if (err.errors) {
    return res.status(400).json({ errors: err.errors });
  }

  res.status(err.statusCode || 500).json({
    msg: err.message || 'Server Error',
  });
};

module.exports = errorHandler;

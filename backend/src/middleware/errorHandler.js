const ApiError = require("../utils/ApiError");

function notFoundHandler(req, res) {
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.originalUrl}` } });
}

// Central error handler — every asyncHandler-wrapped route funnels errors here.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({ error: { message: err.message, details: err.details } });
  }

  if (err.name === "MulterError") {
    const msg = err.code === "LIMIT_FILE_SIZE" ? "File is too large" : `Upload error: ${err.message}`;
    return res.status(400).json({ error: { message: msg } });
  }

  if (err.code === "P2002") {
    // Prisma unique constraint violation
    const target = String(err.meta?.target || "");
    const friendly = target.includes("emailHash")
      ? "That email is already registered"
      : target.includes("phoneHash")
        ? "That phone number is already registered"
        : `Duplicate value for ${target}`;
    return res.status(409).json({ error: { message: friendly } });
  }
  if (err.code === "P2025") {
    // Prisma record not found
    return res.status(404).json({ error: { message: "Record not found" } });
  }

  console.error(err); // eslint-disable-line no-console
  res.status(500).json({ error: { message: "Internal server error" } });
}

module.exports = { notFoundHandler, errorHandler };

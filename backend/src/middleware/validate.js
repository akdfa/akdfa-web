const ApiError = require("../utils/ApiError");

// validate({ body, query, params }) — each value is a zod schema.
// Parsed (and coerced) values are written back onto req so handlers get clean data.
function validate(schemas) {
  return (req, res, next) => {
    for (const key of ["body", "query", "params"]) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        return next(ApiError.badRequest(`Invalid ${key}`, result.error.flatten()));
      }
      req[key] = result.data;
    }
    next();
  };
}

module.exports = validate;

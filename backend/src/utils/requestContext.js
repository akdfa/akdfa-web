// Per-request context (client IP) that deep helpers like logAudit can read without threading `req` everywhere.
const { AsyncLocalStorage } = require("async_hooks");
const storage = new AsyncLocalStorage();
module.exports = {
  middleware: (req, _res, next) => storage.run({ ip: req.ip }, next),
  current: () => storage.getStore() || {},
};

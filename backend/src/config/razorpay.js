const Razorpay = require("razorpay");
const env = require("./env");

// Returns null when keys aren't configured yet (local dev without Phase 5 wired up)
// so payment routes can fail with a clear 503 instead of throwing on require().
function getRazorpayClient() {
  if (!env.razorpay.keyId || !env.razorpay.keySecret) return null;
  return new Razorpay({ key_id: env.razorpay.keyId, key_secret: env.razorpay.keySecret });
}

module.exports = { getRazorpayClient };

const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const env = require("../config/env");

function signAccessToken(member) {
  return jwt.sign(
    { sub: member.id, role: member.role, districtId: member.districtId, unitId: member.unitId },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessTtl }
  );
}

function signRefreshToken(member) {
  return jwt.sign({ sub: member.id }, env.jwt.refreshSecret, { expiresIn: env.jwt.refreshTtl });
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

// We never store raw refresh tokens — only this hash — so a DB leak can't be replayed directly.
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
};

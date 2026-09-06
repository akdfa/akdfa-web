process.env.ENCRYPTION_KEY = "0".repeat(64);
const test = require("node:test");
const assert = require("node:assert/strict");
const { encrypt, decrypt, blindIndex, isEncrypted, cardVerifyToken } = require("../src/utils/crypto");

test("encrypt/decrypt round-trips", () => {
  const plain = "akhil@example.com";
  const c = encrypt(plain);
  assert.ok(c.startsWith("v1:"));
  assert.equal(decrypt(c), plain);
});

test("encrypt is idempotent on ciphertext", () => {
  const c = encrypt("hello");
  assert.equal(encrypt(c), c);
});

test("decrypt passes plaintext / legacy values through untouched", () => {
  assert.equal(decrypt("not-encrypted"), "not-encrypted");
  assert.equal(decrypt(null), null);
  assert.equal(decrypt(undefined), undefined);
});

test("null / empty inputs are left alone", () => {
  assert.equal(encrypt(null), null);
  assert.equal(encrypt(""), "");
  assert.equal(blindIndex(""), "");
});

test("blindIndex is deterministic and case/space-insensitive", () => {
  assert.equal(blindIndex("A@B.com"), blindIndex("  a@b.com "));
  assert.notEqual(blindIndex("a@b.com"), blindIndex("c@d.com"));
  assert.match(blindIndex("x@y.com"), /^[0-9a-f]{64}$/);
});

test("wrong key fails closed to the raw value (never throws mid-query)", () => {
  const c = encrypt("secret");
  process.env.ENCRYPTION_KEY = "1".repeat(64);
  delete require.cache[require.resolve("../src/utils/crypto")];
  delete require.cache[require.resolve("../src/config/env")];
  const other = require("../src/utils/crypto");
  assert.equal(other.decrypt(c), c); // returns the ciphertext, not an exception
});

test("cardVerifyToken is a stable 16-hex tag", () => {
  process.env.ENCRYPTION_KEY = "0".repeat(64);
  delete require.cache[require.resolve("../src/utils/crypto")];
  delete require.cache[require.resolve("../src/config/env")];
  const { cardVerifyToken: t } = require("../src/utils/crypto");
  assert.equal(t("AKDFA-00001"), t("AKDFA-00001"));
  assert.match(t("AKDFA-00001"), /^[0-9a-f]{16}$/);
  assert.notEqual(t("AKDFA-00001"), t("AKDFA-00002"));
});

test("isEncrypted", () => {
  assert.equal(isEncrypted(encrypt("a")), true);
  assert.equal(isEncrypted("plain"), false);
  assert.equal(isEncrypted(123), false);
});

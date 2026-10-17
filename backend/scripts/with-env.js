// Runs a command with the same layered env the app uses (.env.<NODE_ENV>.local →
// .env.local → .env.<NODE_ENV> → .env). The Prisma CLI only reads plain `.env`,
// so without this `prisma migrate deploy` would ignore .env.local / .env.development.
//
//   node scripts/with-env.js prisma migrate deploy
require("../src/config/env");
const { spawnSync } = require("child_process");

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error("usage: node scripts/with-env.js <command> [args…]"); // eslint-disable-line no-console
  process.exit(2);
}
const r = spawnSync(cmd, args, { stdio: "inherit", shell: true, env: process.env });
process.exit(r.status ?? 1);

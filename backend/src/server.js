const app = require("./app");
const env = require("./config/env");

app.listen(env.port, () => {
  console.log(`AKDFA API listening on http://localhost:${env.port}`); // eslint-disable-line no-console
});

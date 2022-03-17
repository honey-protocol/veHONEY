const fs = require("fs");
import type { WhitelistTest } from "./whitelist_test";

export const whitelistTestIdl = JSON.parse(
  fs.readFileSync("./tests/workspace/whitelist_test.json", "utf8")
);
export type WhitelistTestTypes = WhitelistTest;

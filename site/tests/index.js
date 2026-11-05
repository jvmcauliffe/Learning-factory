"use strict";
/* Lets the literal command `node --test site/tests` work on Node 22, which treats the
 * argument as a file path instead of a folder. It loads every test file in this folder.
 * `node --test "site/tests/*.test.js"` runs the same tests without this file. */
const fs = require("node:fs");
const path = require("node:path");
fs.readdirSync(__dirname).filter((f) => f.endsWith(".test.js")).sort().forEach((f) => require(path.join(__dirname, f)));

// Copyright (c) 2024 System233
// 
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { run } from "node:test";
import { globSync } from "glob";
import { spec } from "node:test/reporters";
import process from "node:process";

const pattern = [
  "./**/*.test.ts",
  "./**/*.spec.ts",
  "./**/*.test.js",
  "./**/*.spec.js",
];
const files = globSync(pattern, { dotRelative: true });

run({
  files,
})
  .on("test:fail", (data) => {
    if (data.todo === undefined || data.todo === false) {
      process.exitCode = 1;
    }
  })
  .compose(spec)
  .pipe(process.stdout);

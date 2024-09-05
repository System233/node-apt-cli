// Copyright (c) 2024 System233
// 
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import assert, { strictEqual } from "node:assert";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parsePackageVersionString, testVersion } from "../lib/utils.js";
import { IPackageVersion, Op } from "../lib/interface.js";

interface Case {
  line: string;
  x: IPackageVersion;
  op: Op;
  y: IPackageVersion;
  expect: boolean;
}
interface Group {
  file: string;
  cases: Case[];
}

const loadCases = async () => {
  const baseDir = join(import.meta.dirname ?? "tests", "version-compare-cases");
  const list = await readdir(baseDir);
  const filelist = list.filter((x) => x.endsWith(".txt"));
  return await Promise.all(
    filelist.map(async (file) => {
      const content = await readFile(join(baseDir, file), "utf-8");
      const lines = content
        .split("\n")
        .map((x) => x.trim())
        .filter((x) => x.length);
      const cases = lines.map((line) => {
        const match =
          /^\s*(\S+)\s*(>>|<<|<=|>=|=)\s*(\S*?)\s*\/\/\s*(true|false)\s*$/.exec(
            line
          );
        assert(match != null, `bad_case:${file}:${line}`);
        const x = parsePackageVersionString(match[1]);
        const y = parsePackageVersionString(match[3]);
        assert(x != null, `bad_version:${file}:${line}:version=${match[1]}`);
        assert(y != null, `bad_version:${file}:${line}:version=${match[3]}`);
        return {
          line,
          x,
          op: match[2] as Op,
          y,
          expect: match[4] == "true",
        };
      });
      return {
        file,
        cases,
      };
    })
  );
};
describe("version-compare", async () => {
  let groups: Group[] = await loadCases();

  for (const group of groups) {
    for (const ca of group.cases) {
      const expr = `${ca.x.version}${ca.op}${ca.y.version}`;
      it(`${expr}==${ca.expect}`, () => {
        const actual = testVersion(ca.x, ca.op, ca.y);
        
        strictEqual(
          actual,
          ca.expect,
          `fail:${group.file}:${expr}`
        );
      });
    }
  }
});

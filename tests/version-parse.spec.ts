// Copyright (c) 2024 System233
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { deepStrictEqual } from "node:assert";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import { IPackageVersion } from "../lib/interface.js";
import { parsePackageVersionString } from "../lib/parsers.js";

interface Group {
  file: string;
  cases: IPackageVersion[];
}

const loadCases = async () => {
  const baseDir = join(import.meta.dirname ?? "tests", "version-parse-cases");
  const filelist = await readdir(baseDir);
  return await Promise.all(
    filelist.map(async (file) => {
      const content = await readFile(join(baseDir, file), "utf-8");
      const lines = content
        .split("\n")
        .map((x) => x.trim())
        .filter((x) => x.length);
      const cases = lines.map((line) => {
        const [version, epoch, upstream_version, debian_revision] =
          line.split(",");
        const expect: IPackageVersion = {
          version,
          epoch: +(epoch ?? 0),
          upstream_version: upstream_version ?? "",
          debian_revision: debian_revision ?? "",
        };
        return expect;
      });
      return {
        file,
        cases,
      };
    })
  );
};
describe("version-parse", async () => {
  let groups: Group[] = await loadCases();

  for (const group of groups) {
    for (const version of group.cases) {
      it(`${version.version}`, () => {
        const actual = parsePackageVersionString(version.version);
        deepStrictEqual(actual, version);
      });
    }
  }
});

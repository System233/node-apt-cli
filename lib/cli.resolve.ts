#!/usr/bin/env node
// Copyright (c) 2024 System233
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { Command, program } from "commander";
import { PackageManagerOption } from "./interface.js";
import { printDependencyTree } from "./parsers.js";
import { createPackageManager } from "./cli.util.js";

export interface CLIOption extends PackageManagerOption {
  entry: string[];
  entryFile: string[];
  recursive: boolean;
  arch: string;
  format: string;
  indent: number;
  newline?: string;
  userAgent?: string;
  noMissing: boolean;
  missing: boolean;
  unique: boolean;
  cacheIndex: boolean;
  authConf?: string;
  quiet?: boolean;
}
const main = async (packages: string[], opt: CLIOption) => {
  Object.assign(opt, program.opts());
  opt.architecture = opt.arch;
  if (opt.newline) {
    opt.format = opt.format.split(opt.newline).join("\n");
  }
  const manager = await createPackageManager(opt);
  await manager.load();

  packages.forEach((selector) => {
    const pkg = manager.resolve(selector, opt);
    if (pkg == null) {
      console.error(`Error: Package ${JSON.stringify(selector)} not found.`);
      return;
    }
    printDependencyTree(pkg, opt);
  });
};
export const resolveCommand = new Command("resolve")
  .description("Search packages via package selector")
  .option("-r, --recursive", "recursive package search.")
  .option("--no-missing", "hidden missing dependencies.")
  .option("--indent <INT>", "tree indent width.", (x) => parseInt(x), 2)
  .option("--no-unique", "no package scope duplicate dependency filtering.")
  .option(
    "--format <FORMAT>",
    "package print format.",
    "{package}:{architecture} ({selector})"
  )
  .argument("<package...>", "list of packages to be parsed.")
  .action(main);

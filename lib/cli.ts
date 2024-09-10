#!/usr/bin/env node
// Copyright (c) 2024 System233
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { program } from "commander";
import {
  loadAPTAuthConf,
  PackageManager,
  PackageManagerOption,
  parseSourceEnrty,
  parseSourceListFile,
  printDependencyTree,
} from "./index.js";

export interface CLIOption extends PackageManagerOption {
  entry: string[];
  entryFile: string[];
  recursive: boolean;
  arch: string;
  format: string;
  indent: number;
  newline?: string;
  noMissing: boolean;
  missing: boolean;
  unique: boolean;
  cacheIndex: boolean;
  authConf?: string;
}
const main = async (packages: string[], opt: CLIOption) => {
  opt.architecture = opt.arch;
  if (opt.newline) {
    opt.format = opt.format.split(opt.newline).join("\n");
  }
  const manager = new PackageManager(opt);
  opt.entry.forEach((item) => {
    const reop = parseSourceEnrty(item);
    if (reop == null) {
      return;
    }
    manager.repository.create(reop);
  });
  const entries = await parseSourceListFile(opt.entryFile);
  entries.forEach((entry) => manager.repository.create(entry));

  if (!manager.repository.findAll().length) {
    console.error(
      "Error: No valid APT entry was found. Please specify an entry using the --entry or --entry-file option."
    );
    process.exit(1);
  }
  if (opt.authConf) {
    const data = await loadAPTAuthConf(opt.authConf);
    data.forEach((item) => manager.auth.conf.push(item));
  }
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
program
  .name("apt-cli")
  .option("-r, --recursive", "recursive package search.")
  .option("-c, --cache-dir <DIR>", "metadata cache path.")
  .option("-a, --arch <ARCH>", "default architecture.", "any")
  .option("--no-missing", "hidden missing dependencies.")
  .option("--auth-conf <auth.conf>", "apt auth.conf configuration.")
  .option("--no-unique", "no package scope duplicate dependency filtering.")
  .option("--newline <LF>", "format line break markers.")
  .option("--cache-index", "cache package indexes.")
  .option(
    "--format <FORMAT>",
    "package print format.",
    "{package}:{architecture} ({selector})"
  )
  .option("--indent <INT>", "tree indent width.", (x) => parseInt(x), 2)
  .option(
    "-e, --entry <ENTRY>",
    "APT source entry.",
    (x, y) => y.concat([x]),
    [] as string[]
  )
  .option(
    "-f, --entry-file <FILE>",
    "APT sources.list file.",
    (x, y) => y.concat([x]),
    [] as string[]
  )
  .argument("<package...>", "list of packages to be parsed.")
  .action(main)
  .parse();

// Copyright (c) 2024 System233
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { Command, program } from "commander";
import { PackageManagerOption } from "./interface.js";
import { createPackageManager } from "./cli.util.js";
import { formatMessage } from "./utils.js";
export interface CLIFindOption extends PackageManagerOption {
  entry: string[];
  entryFile: string[];
  arch: string;
  format: string;
  newline?: string;
  noMissing: boolean;
  missing: boolean;
  cacheIndex: boolean;
  authConf?: string;
  quiet?: boolean;
  userAgent?: string;
}
export const find = async (regex: string[], opt: CLIFindOption) => {
  Object.assign(opt, program.opts());
  opt.architecture = opt.arch;
  if (opt.newline) {
    opt.format = opt.format.split(opt.newline).join("\n");
  }
  const manager = await createPackageManager(opt);
  await manager.loadMetadata(opt);
  await manager.loadContents(opt);
  await Promise.all(
    regex.map(async (item) => {
      const result = await manager.find(item);
      result.forEach((item) => console.log(formatMessage(item, opt.format)));
    })
  );
};
export const findCommand = new Command("find")
  .description("Find package name by file name like apt-file")
  .argument("<regex...>", "Regular expressions to search for")
  .option(
    "--format <FORMAT>",
    "package print format.",
    "{package}:{index.architecture}: {path}"
  )
  .action(find);

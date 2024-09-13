// Copyright (c) 2024 System233
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { PackageManager } from "./manager.js";
import {
  parseSourceEnrties,
  parseSourceListFile,
  loadAPTAuthConf,
} from "./parsers.js";
export interface CLIBaseOption {
  entry?: string[];
  entryFile: string[];
  architecture?: string;
  cacheDir?: string;
  cacheIndex?: boolean;
  quiet?: boolean;
  authConf?: string;
}
export const createPackageManager = async (opt: CLIBaseOption) => {
  const manager = new PackageManager(opt);
  const entries1 = parseSourceEnrties(opt.entry ?? []);
  entries1.forEach((item) => manager.repository.create(item));
  const entries2 = await parseSourceListFile(opt.entryFile);
  entries2.forEach((entry) => manager.repository.create(entry));

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
  return manager;
};

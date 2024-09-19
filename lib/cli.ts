#!/usr/bin/env node
// Copyright (c) 2024 System233
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { program } from "commander";
import { resolveCommand } from "./cli.resolve.js";
import { findCommand } from "./cli.find.js";

program
  .option("-c, --cache-dir <DIR>", "metadata cache path.")
  .option("-a, --arch <ARCH>", "default architecture.", "any")
  .option("--auth-conf <auth.conf>", "apt auth.conf configuration.")
  .option("--newline <LF>", "format line break markers.")
  .option("--cache-index", "cache package indexes.")
  .option("--quiet", "no progress bar.")
  .option("--retry", "retry times.", parseInt, 10)

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
  .addCommand(resolveCommand)
  .addCommand(findCommand)
  .parse();

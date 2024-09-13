// Copyright (c) 2024 System233
//
// This software is released under the MIT License.

import { fetchMetadata } from "../lib/utils";

fetchMetadata("http://127.0.0.1:5500", "cache/Contents-amd64.bz2", null, {
  cacheDir: "cache",
  // quiet: true,
}).then((x) => console.log("result", x));

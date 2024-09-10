// Copyright (c) 2024 System233
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { APTAuthConf } from "./interface.js";

export class AuthManager {
  readonly conf: APTAuthConf[] = [];
  constructor() {}

  find(url: string | URL): APTAuthConf | null {
    if (url instanceof URL) {
      return this.find(url.toString());
    }
    return this.conf.find((item) => url.startsWith(item.url)) ?? null;
  }
}

// Copyright (c) 2024 System233
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { promisify } from "util";
import { unzip } from "zlib";
import {
  APTAuthConf,
  HashType,
  IHash,
  IPackage,
  IPackageVersion,
  IRepository,
  IVersion,
  Op,
  PackageKey,
  PackageSelector,
  PrintOption,
} from "./interface.js";
import { MultiBar } from "cli-progress";
import assert from "assert";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";
import { compareVersion } from "./version_compare.js";
import { ReadableStream, WritableStream } from "node:stream/web";
import { deserialize, serialize } from "v8";

export interface FetchMetadataOption {
  gzip?: boolean;
  cacheDir?: string;
  cacheIndex?: boolean;
  hash?: IHash[];
  auth?: (url: string) => { username: string; password: string } | null;
}
export const basicAuthorization = (username: string, password: string) =>
  [
    "Authorization",
    "Basic " + Buffer.from(username + ":" + password).toString("base64"),
  ] as [string, string];

export const buildBasicAuthorizationFromURL = (url: URL) => {
  if (url.password || url.username) {
    const { username, password } = url;
    url.username = "";
    url.password = "";
    return [basicAuthorization(username, password)];
  }
  return null;
};

const inflateAsync = promisify(unzip);
const bars = new MultiBar({
  format: ' {bar} | "{file}" | {value}/{total}',
  hideCursor: true,
  barCompleteChar: "\u2588",
  barIncompleteChar: "\u2591",
  clearOnComplete: false,
  stopOnComplete: true,
  noTTYOutput: true,
});
const readStream = (name: string, stream: FetchBlobStream) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    const bar = bars.create(stream.size, 0, { file: name });
    const hash = stream.hash ? createHash(stream.hash.type) : null;
    const ws = new WritableStream<Uint8Array>({
      start() {
        // bar.start(total,0,{file: name})
      },
      write(chunk) {
        chunks.push(chunk);
        hash?.update(chunk);
        bar.increment(chunk.byteLength);
      },
      close() {
        bar.stop();
        if (hash && stream.hash) {
          const hex = hash.digest("hex");
          assert(
            stream.hash.hash == hex,
            `${name} ${stream.hash.type} not match (${stream.hash.hash}!=${hex})`
          );
        }
        resolve(Buffer.concat(chunks));
      },
      abort(reason) {
        bar.stop();
        reject(reason);
      },
    });
    stream.stream.pipeTo(ws);
  });
interface FetchBlobStream {
  stream: ReadableStream<Uint8Array>;
  size: number;
  hash?: IHash;
}
const getLocalCacheName = (url: string) => url.replace(/[^\w]+/g, "_");
const loadLocalCache = async (cacheDir: string, url: string) => {
  try {
    const name = getLocalCacheName(url);
    const file = join(cacheDir, name);
    const buffer = await readFile(file);
    return buffer;
  } catch (error) {
    return null;
  }
};
const saveLocalCache = async (
  cacheDir: string,
  url: string,
  buffer: Buffer
) => {
  const name = getLocalCacheName(url);
  const file = join(cacheDir, name);
  await mkdir(cacheDir, { recursive: true });
  await writeFile(file, buffer);
};
const getAuthHeaders = (url: string, option?: FetchMetadataOption) => {
  const auth = option?.auth?.(url);
  if (auth) {
    return [basicAuthorization(auth.username, auth.password)];
  }
  return undefined;
};
const fetchBlobNetwork = async (
  url: string,
  option?: FetchMetadataOption
): Promise<Buffer | null> => {
  const parsedURL = new URL(url);
  const headers =
    buildBasicAuthorizationFromURL(parsedURL) || getAuthHeaders(url, option);
  const resp = await fetch(parsedURL, { headers });
  if (resp.status >= 400) {
    throw new Error(`fetch ${url}: ${resp.status} ${resp.statusText}`);
  }
  const total = +(resp.headers.get("content-length") ?? 0);
  assert(resp.body != null, "resp.body is null");
  const hash = option?.hash?.find((x) =>
    option.gzip ? x.path.endsWith(".gz") : !x.path.endsWith(".gz")
  );
  const buffer = await readStream(url, {
    stream: resp.body,
    size: total,
    hash: hash,
  });
  if (option?.cacheDir) {
    await saveLocalCache(option.cacheDir, url, buffer);
  }
  return buffer;
};
const fetchBlobLocal = async (
  url: string,
  option?: FetchMetadataOption
): Promise<Buffer | null> => {
  if (!option?.cacheDir) {
    return null;
  }

  const buffer = await loadLocalCache(option.cacheDir, url);
  if (buffer && option.hash) {
    const hash = option.hash.find((item) => {
      const hex = createHash(item.type).update(buffer).digest("hex");
      if (hex === item.hash) {
        return true;
      }
      return false;
    });
    if (!hash) {
      console.warn(`Warn: The cache did not match any hash: ${url}`);
      return null;
    }
  }
  return buffer;
};
export const fetchBlob = async (url: string, option?: FetchMetadataOption) => {
  if (option?.gzip) {
    url += ".gz";
  }
  const buffer =
    (await fetchBlobLocal(url, option)) ??
    (await fetchBlobNetwork(url, option));
  assert(buffer != null, `${url}: fail`);
  if (!option?.gzip) {
    return buffer.toString();
  }

  const data = await inflateAsync(buffer);
  return data.toString();
};
export const fetchMetadata = async <K extends string>(
  url: string,
  option?: FetchMetadataOption
) => {
  let data: string | null = null;
  try {
    data = option?.gzip ? await fetchBlob(url, option) : null;
  } catch (error) {}
  if (!data) {
    data = await fetchBlob(url, Object.assign({}, option, { gzip: false }));
  }
  return parseMetadata<K>(data);
};
export const fetchAndCacheMetadata = async <K extends string>(
  url: string,
  option?: FetchMetadataOption
) => {
  if (option?.cacheDir && option.cacheIndex) {
    const cache = url + ".index";
    const buffer = await loadLocalCache(option.cacheDir, cache);
    if (buffer) {
      try {
        return deserialize(buffer) as Record<K, string>[];
      } catch (error) {
        console.error("Error: BadIndexCache:%s", url);
      }
    }
    const data = await fetchMetadata(url, option);
    await saveLocalCache(option.cacheDir, cache, serialize(data));
    return data;
  }
  return await fetchMetadata(url, option);
};

export const parseMetadata = <K extends string>(
  text: string
): Record<K, string>[] => {
  let i = 0,
    lineNo = 0,
    lineStart = 0;
  const find = (ch: string) => {
    let index = i;
    while (text[index] != ch && index < text.length) {
      ++index;
    }
    // if (index == i) {
    //   return -1;
    // }
    return index;
  };
  const sliceToNext = (ch: string) => {
    const start = i;
    const end = find(ch);
    if (end != -1) {
      i = end;
      return text.slice(start, end).trim();
    }
    throw new Error(
      `parseMetadata: line ${lineNo}:${lineStart}:  expected ${JSON.stringify(
        ch
      )} not found`
    );
  };
  const readKey = () => sliceToNext(":");
  const nextLine = () => {
    lineNo++;
    lineStart = i;
  };
  const readValue = () => sliceToNext("\n");
  let lastKey = null;
  let data: Record<string, string> = {};
  const list: Record<string, string>[] = [];
  while (i < text.length) {
    const ch = text[i];
    if (ch == "\n") {
      i++;
      nextLine();
      if (Object.keys(data).length) {
        list.push(data);
        data = {};
      }
    } else if (/\s/.test(ch)) {
      i++;
      const line = readValue();
      if (lastKey != null) {
        if (line == ".") {
          data[lastKey] += "\n";
        } else {
          data[lastKey] += "\n" + line;
        }
      }
      nextLine();
      i++;
    } else if (ch == ":") {
      i++;
      const value = readValue();
      if (lastKey != null) {
        data[lastKey] = value;
      }
      nextLine();
      i++;
    } else {
      lastKey = readKey();
    }
  }
  if (lastKey && !(lastKey in data)) {
    data[lastKey] = "";
  }
  list.push(data);
  return list;
};

export const parsePackageVersionString = (
  version: string
): IPackageVersion | null => {
  if (!version) {
    return null;
  }
  const match =
    /^(?:(\d+):)?([0-9][A-Za-z0-9.+-~]*?)(?:-([A-Za-z0-9.+~]*))?$/.exec(
      version
    );
  if (!match) {
    return null;
  }
  return {
    version,
    epoch: +(match?.[1] ?? 0),
    debian_revision: match?.[3] ?? "",
    upstream_version: match?.[2] ?? "",
  };
};
export const parsePackageVersion = (pkg: IVersion | null) => {
  if (!pkg) {
    return null;
  }
  if (pkg.parsedVersion) {
    return pkg.parsedVersion;
  }
  const version = parsePackageVersionString(pkg.version);
  pkg.parsedVersion = version;
  return pkg.parsedVersion;
};

export const getPackageProvides = (pkg: IPackage) => {
  if (!pkg.parsedProvides) {
    pkg.parsedProvides =
      pkg.provides?.flatMap((item) => parsePackageSelect(item)) ?? [];
  }
  return pkg.parsedProvides;
};
export const parsePackageHash = (
  pkg: Record<PackageKey, string>
): Record<HashType, string> => {
  const hashes = Object.fromEntries(
    Object.entries({
      md5: "MD5sum",
      sha1: "SHA1",
      sha256: "SHA256",
      sha512: "SHA512",
    })
      .filter(([_, value]) => value in pkg)
      .map(([type, key]) => [type as HashType, pkg[key as PackageKey]] as const)
  ) as Record<HashType, string>;
  return hashes;
};
export const parsePackageSelect = (select: string): PackageSelector[] =>
  select
    .split("|")
    .map((selector) => {
      const match =
        /^\s*([a-z0-9+.-]+)(?::([a-z0-9-]+))?(?:\s*\(?(<=|>=|<<|>>|=)\s*((?:\d+:)?[a-zA-Z0-9.+~-]+)\)?)?\s*$/.exec(
          selector
        );
      if (!match) {
        return null;
      }
      const op = match?.[3] as Op;
      const version = match?.[4];
      return {
        selector,
        package: match?.[1],
        architecture: match?.[2],
        op,
        version,
      };
    })
    .filter((x) => x != null);

const compareResult = (x: number | null, op: Op) => {
  if (x == null) {
    return true;
  }
  switch (op) {
    case "<=":
      return x <= 0;
    case ">=":
      return x >= 0;
    case "<<":
      return x < 0;
    case ">>":
      return x > 0;
    case "=":
      return x == 0;
  }
};
export const comparePackageVersion = (
  x: IPackageVersion | null,
  y: IPackageVersion | null
) => {
  if (x == null || y == null) {
    return null;
  }
  return (
    x.epoch - y.epoch ||
    compareVersion(x.upstream_version, y.upstream_version) ||
    compareVersion(x.debian_revision, y.debian_revision)
  );
};
export const compareParsedPackageVersion = (
  x: IVersion | null,
  y: IVersion | null
) => {
  const v1 = parsePackageVersion(x);
  const v2 = parsePackageVersion(y);
  return comparePackageVersion(v1, v2);
};
export const testVersion = (x: IVersion, op: Op, y: IVersion): boolean => {
  const result = compareParsedPackageVersion(x, y);
  return compareResult(result, op);
};
const formatWalk = (pkg: IPackage, key: string) =>
  key.split(".").reduce((x, y) => x?.[y], pkg as any);
export const formatPackage = (pkg: IPackage, format: string) =>
  format.replace(/(?:{\s*([\w\.]+)\s*})/g, (_, key) => formatWalk(pkg, key));
export const printDependencyTree = (pkg: IPackage, option: PrintOption) => {
  const queue = new Set();
  const print = (pkg: IPackage, depth: number = 0) => {
    const indent = " ".repeat(option.indent * depth);
    console.log(`${indent}${formatPackage(pkg, option.format)}`);
    pkg.dependencies?.forEach((item) => {
      const id = `${item.package}:${item.architecture}:${item.version}`;
      if (!queue.has(id)) {
        queue.add(id);
        print(item, depth + 1);
        if (!option.unique) {
          queue.delete(id);
        }
      }
    });
  };
  print(pkg);
};

export const parseSourceEnrty = (entry: string): IRepository | null => {
  const match =
    /^(deb|deb-src)\s+?(?:\[(.*?)\])?\s*(\S+)\s+(\S+)(?:\s+(.+))?$/.exec(entry);
  if (!match) {
    console.error(`Error: Bad Enrty: ${JSON.stringify(entry)}`);
    return null;
  }
  const type = match[1] as "deb" | "deb-src";
  const option = Object.fromEntries(
    match[2]?.split(/\s+/).map((x) => x.split("=")) ?? []
  ) as Record<"arch", string>;
  const url = match[3];
  const distribution = match[4];
  const components = match[5]?.split(/\s+/);
  return {
    type,
    url,
    distribution,
    components,
    architectures: option.arch?.split(",").map((x) => x.trim()),
  };
};
export const parseSourceListFile = async (entryList: string[]) => {
  const entries = await Promise.all(
    entryList.map(async (file) => {
      const source = await readFile(file, "utf8");
      const lines = source
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length && !line.startsWith("#"));
      return lines
        .map((entry) => parseSourceEnrty(entry))
        .filter((x) => x != null);
    })
  );
  return entries.flat();
};

export const findItemHash = (hash: IHash[], item: string) => {
  const gzitem = item + ".gz";
  let gzip = false;
  const filtered = hash.filter((hash) => {
    const isGzip = hash.path == gzitem;
    gzip = gzip || isGzip;
    return hash.path == item || isGzip;
  });
  return { gzip, hash: filtered };
};

export const loadAPTAuthConf = async (file: string, noWarn: boolean = true) => {
  const data = await readFile(file, "utf8");
  return data
    .split("\n")
    .map((x) => x.trim())
    .filter((x) => !x.startsWith("#"))
    .map((line) => {
      const match =
        /^\s*machine\s+(?:(\S+):\/\/)?(\S+)\s+login\s+(\S+)\s+password\s+(\S+)$/.exec(
          line
        );
      if (!match) {
        if (!noWarn) {
          console.warn("无效APT授权配置:", line);
        }
        return null;
      }
      const [, protocol, location, username, password] = match;
      const url = `${protocol ?? "https"}://${location}`;
      return { url, username, password } as APTAuthConf;
    })
    .filter((x) => x != null);
};

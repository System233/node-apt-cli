// Copyright (c) 2024 System233
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { readFile } from "fs/promises";
import {
  IPackageVersion,
  IVersion,
  IPackage,
  PackageKey,
  HashType,
  PackageSelector,
  Op,
  PrintOption,
  IRepository,
  IHash,
  APTAuthConf,
  IContentItem,
  IContentIndex,
} from "./interface.js";
import { compareVersion } from "./version_compare.js";
import { formatMessage } from "./utils.js";

export const serachContents = async (index: IContentIndex, text: string) => {
  let matchBegin = ".*";
  let matchEnd = ".*";

  if (text.endsWith("$")) {
    text = text.slice(0, -1);
    matchEnd = "";
  }
  if (text.startsWith("^")) {
    text = text.slice(1);
    matchBegin = "";
  }
  const regex = new RegExp(
    `^(${matchBegin}(?:${text})${matchEnd})\\s+(.+)\\s*$`
  );
  const contents = await index.contents();
  if (!contents) {
    return [];
  }
  const result: IContentItem[] = [];
  for await (const line of contents) {
    const match = regex.exec(line);
    if (match) {
      const [, path, target] = match;
      result.push(
        ...target.split(",").map((target) => {
          const [type, pkg] = target.split("/", 2);
          return {
            index,
            type,
            package: pkg,
            path,
          } as IContentItem;
        })
      );
    }
  }
  return result;
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

export const printDependencyTree = (pkg: IPackage, option: PrintOption) => {
  const queue = new Set();
  const print = (pkg: IPackage, depth: number = 0) => {
    const indent = " ".repeat(option.indent * depth);
    console.log(`${indent}${formatMessage(pkg, option.format)}`);
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
export const parseSourceEnrties = (entry: string[]) => {
  return entry.map((item) => parseSourceEnrty(item)).filter((x) => x != null);
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

export const findItemHash = (hash: IHash[], item: string) =>
  hash.filter((hash) => hash.path.startsWith(item));

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

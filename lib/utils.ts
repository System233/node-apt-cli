// Copyright (c) 2024 System233
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { IHash } from "./interface.js";
import { access, mkdir } from "fs/promises";
import { extname, join } from "path";
import { Readable } from "stream";
import { createReadStream } from "fs";
import {
  createBzip2Stream,
  createCacheStream,
  createGzipStream,
  createHashStream,
  createProgressStream,
  createXZStream,
  pipelineDuplex,
  streamToBuffer,
  toReadableStream,
} from "./streams.js";
import { parseMetadata } from "./parsers.js";
import { createInterface } from "readline/promises";

export interface FetchMetadataOption {
  cacheDir?: string;
  cacheIndex?: boolean;
  quiet?: boolean;
  retry?: number;
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

const getLocalCache = async (
  cacheDir: string,
  url: string,
  noMkdir?: boolean
) => {
  const name = url.replace(/[^\w]+/g, "_");
  const file = join(cacheDir, name);
  if (!noMkdir) {
    await mkdir(cacheDir, { recursive: true });
  }
  return file;
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
): Promise<Readable> => {
  const parsedURL = new URL(url);
  const headers =
    buildBasicAuthorizationFromURL(parsedURL) || getAuthHeaders(url, option);
  let resp: Response | null = null;
  for (let i = 0; i < (option?.retry ?? 10); ++i) {
    try {
      resp = await fetch(parsedURL, { headers });
      if (resp.status >= 400 || resp.body == null) {
        throw new Error(`fetch ${url}: ${resp.status} ${resp.statusText}`);
      }
    } catch (error) {
      console.error(`fetch ${url}:`, error);
    }
  }
  if (resp == null || resp.body == null) {
    throw new Error(`fetch fail: ${url}`);
  }
  const cache = option?.cacheDir
    ? await getLocalCache(option.cacheDir, url)
    : null;
  const total = +(resp.headers.get("content-length") ?? 0);
  let stream = toReadableStream(resp.body);
  if (cache) {
    stream = pipelineDuplex(stream, createCacheStream(cache));
    // stream = stream.pipe(createCacheStream(cache));
  }
  if (!option?.quiet) {
    stream = pipelineDuplex(stream, createProgressStream(url, total));
    // stream = stream.pipe(createProgressStream(url, total));
  }
  return stream;
};
const fetchBlobLocal = async (
  url: string,
  option?: FetchMetadataOption
): Promise<Readable | null> => {
  if (!option?.cacheDir) {
    return null;
  }
  const file = await getLocalCache(option.cacheDir, url, true);
  try {
    await access(file);
  } catch (error) {
    return null;
  }
  return createReadStream(file);
};
export const fetchBlob = async (
  url: string,
  hash?: IHash | null,
  option?: FetchMetadataOption
): Promise<Readable> => {
  let stream =
    (await fetchBlobLocal(url, option)) ??
    (await fetchBlobNetwork(url, option));
  if (hash) {
    stream = pipelineDuplex(
      stream,
      createHashStream(hash.path, hash.type, hash.hash)
    );
    // stream = stream.pipe(createHashStream(hash.path, hash.type, hash.hash));
  }
  const ext = extname(url).toLowerCase();
  if (ext == ".bz2") {
    stream = pipelineDuplex(stream, createBzip2Stream());
  } else if (ext == ".gz" || ext == ".gzip") {
    stream = pipelineDuplex(stream, createGzipStream());
  } else if (ext == ".xz") {
    stream = pipelineDuplex(stream, createXZStream());
  }
  return stream;
};
export const fetchToStream = async (
  base: string,
  name: string,
  hashes?: IHash[] | null,
  option?: FetchMetadataOption
) => {
  if (hashes) {
    const sorted = hashes.sort((x, y) => x.size - y.size);
    for (const hash of sorted) {
      try {
        const url = `${base}/${hash.path}`;
        const stream = await fetchBlob(url, hash, option);
        return stream;
      } catch (error) {
        console.error(error);
      }
    }
    return null;
  }
  const stream = await fetchBlob(`${base}/${name}`, null, option);
  return stream;
};
export const fetchMetadata = async <K extends string>(
  base: string,
  name: string,
  hashes?: IHash[] | null,
  option?: FetchMetadataOption
) => {
  const stream = await fetchToStream(base, name, hashes, option);
  if (!stream) {
    return [];
  }

  const buffer = await streamToBuffer(stream);
  return parseMetadata<K>(buffer.toString("utf8"));
};

export const fetchContents = async (
  base: string,
  name: string,
  hashes?: IHash[] | null,
  option?: FetchMetadataOption
) => {
  const stream = await fetchToStream(base, name, hashes, option);
  if (!stream) {
    return null;
  }
  return createInterface({ input: stream });
};

const formatWalk = (pkg: any, key: string) =>
  key.split(".").reduce((x, y) => x?.[y], pkg as any);

export const formatMessage = (pkg: any, format: string) =>
  format.replace(/(?:{\s*([\w\.]+)\s*})/g, (_, key) => formatWalk(pkg, key));

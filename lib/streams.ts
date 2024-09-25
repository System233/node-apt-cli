// Copyright (c) 2024 System233
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { createUnzip } from "zlib";
import bz2 from "unbzip2-stream";
import xz from "lzma-native";
import { createHash } from "crypto";
import { Duplex, PassThrough, Readable, Stream } from "stream";
import assert from "assert";
import { createWriteStream } from "fs";
import { ReadableStream } from "stream/web";
import { formatUnit, multiBar, truncateFilename } from "./progress.js";
import { rename, unlink } from "fs/promises";

export const pipelineDuplex = <T extends Duplex>(stream: Readable, dest: T) => {
  stream.pipe(dest);
  //   dest.once("close", () => stream.destroy());
  //   pipeline(stream, dest, () => {});
  return dest;
};
export const createGzipStream = () => {
  return createUnzip();
};
export const createBzip2Stream = (): Duplex => {
  return bz2();
};
export const createXZStream = (): Duplex => {
  return xz.createDecompressor();
};
export const createHashStream = (file: string, type: string, hash: string) => {
  const h = createHash(type);
  const passThrough = new PassThrough();
  passThrough.on("data", (data) => h.update(data));
  passThrough.on("end", () => {
    try {
      const hex = h.digest("hex");
      assert.equal(hex, hash, `Corrupted: type=${type} file=${file}`);
    } catch (error) {
      passThrough.destroy(error as Error);
    }
  });
  return passThrough;
};

export const createProgressStream = (file: string, size: number) => {
  const bar = multiBar.create(size, 0);
  const passThrough = new PassThrough();
  let start = 0;
  let current = 0;
  passThrough.once("data", () => {
    start = performance.now();
    bar.start(size, 0, { file: truncateFilename(file), speed_formatted: "NA" });
    const timer = setInterval(() => bar.updateETA(), 500);
    passThrough.once("close", () => {
      clearInterval(timer);
      multiBar.update();
      bar.stop();
      multiBar.stop();
    });
  });
  passThrough.on("data", (chunk: Buffer) => {
    current += chunk.byteLength;
    const time = performance.now() - start;
    bar.update(current, {
      speed_formatted: formatUnit((current / time) * 1000),
    });
  });
  return passThrough;
};
export const streamToBuffer = (stream: Stream) => {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const passThrough = new PassThrough();
    passThrough.on("data", (chunk: Buffer) => chunks.push(chunk));
    passThrough.on("end", () => resolve(Buffer.concat(chunks)));
    passThrough.on("error", reject);
    stream.pipe(passThrough);
  });
};
export const createCacheStream = (to: string, total: number) => {
  const tmp = to + ".tmp";
  const stream = createWriteStream(tmp, { encoding: "binary" });
  const check = async (error?: Error) => {
    try {
      if (error || stream.bytesWritten != total) {
        await unlink(to);
      } else {
        await rename(tmp, to);
      }
    } catch (error) {
      console.error("createCacheStream:" + error, { cause: error });
    }
  };
  stream.once("end", check);
  stream.once("error", check);
  const passThrough = new PassThrough();
  passThrough.pipe(stream);
  return passThrough;
};

export const toReadableStream = (rs: ReadableStream) => {
  return Readable.fromWeb(rs);
};

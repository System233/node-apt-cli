// Copyright (c) 2024 System233
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { MultiBar } from "cli-progress";

export const multiBar = new MultiBar({
  //   format: ' [{bar}] | "{file}" | {value}/{total} Bytes',
  format:
    'Fetch [{bar}] {percentage}% | "{file}" | {value}/{total} | Speed: {speed_formatted}/s | ETA: {eta_formatted}',
  hideCursor: true,
  clearOnComplete: false,
  stopOnComplete: true,
  forceRedraw: true,
  //   fps: 30,
  formatValue(value, opt, type) {
    if (type == "value" || type == "total") {
      return formatUnit(value);
    }
    return value + "";
  },
  //   noTTYOutput: true,
});
const MAX_FILENAME_LENGTH = 50;

export const truncateFilename = (filename: string) => {
  if (filename.length > MAX_FILENAME_LENGTH) {
    return `${filename.slice(0, MAX_FILENAME_LENGTH / 2)}...${filename.slice(
      -MAX_FILENAME_LENGTH / 2
    )}`;
  }
  return filename;
};
const levels = ["B", "KiB", "MiB", "GiB", "TiB"];
export const formatUnit = (size: number) => {
  let step = 1;
  let level = 0;
  for (let i = 0; i < levels.length - 1; ++i) {
    const next = 1024 ** i;
    if (size > next) {
      step = next;
      level = i;
    } else {
      break;
    }
  }
  return `${(size / step).toFixed(1)}${levels[level]}`;
};

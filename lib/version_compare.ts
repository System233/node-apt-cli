// Copyright (c) 2024 System233
// 
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

const isAlpha = (ch: string) =>
  (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
const isDigit = (ch: string) => ch >= "0" && ch <= "9";

//~ < NUM < ALPAH < OTHER
const priority = (ch: string) => {
  if (!ch) {
    return 0;
  }
  if (ch === "~") {
    return -1;
  }
  if (isDigit(ch) || isAlpha(ch)) {
    return ch.charCodeAt(0);
  }
  return ch.charCodeAt(0) + 256;
};
export const compareVersion = (x: string | null, y: string | null) => {
  x ??= "";
  y ??= "";
  for (let i = 0, j = 0; x[i] || y[j]; ) {
    while ((x[i] && !isDigit(x[i])) || (y[j] && !isDigit(y[j]))) {
      const px = priority(x[i]),
        py = priority(y[j]);
      if (px != py) {
        return px < py ? -1 : 1;
      }
      ++i, ++j;
    }
    let cx = 0,
      cy = 0,
      flag = true;
    do {
      if (isDigit(x[i])) {
        cx = cx * 10 + +x[i++];
      } else {
        flag = false;
      }
      if (isDigit(y[j])) {
        cy = cy * 10 + +y[j++];
      } else {
        flag = false;
      }
    } while (flag);

    // while (isDigit(x[i])) {
    //   cx = cx * 10 + +x[i++];
    // }
    // while (isDigit(y[j])) {
    //   cy = cy * 10 + +y[j++];
    // }
    if (cx != cy) {
      return cx < cy ? -1 : 1;
    }
  }
  return 0;
};

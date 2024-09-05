// Copyright (c) 2024 System233
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import {
  IPackage,
  IPackageRelease,
  IRelease,
  IRepository,
  LoadOption,
  PackageKey,
  PackageReleaseKey,
  ReleaseKey,
} from "./interface.js";
import {
  fetchAndCacheMetadata,
  findItemHash,
  parsePackageHash,
} from "./utils.js";

export class Repository implements IRepository {
  type: "deb" | "deb-src";
  url: string;
  distribution: string;
  components: string[];
  architectures?: string[] | undefined;
  metadata: IRelease;
  indexes: IPackage[] = [];
  constructor(option: IRepository) {
    this.type = option.type;
    this.url = option.url;
    this.distribution = option.distribution;
    this.components = option.components;
    this.architectures = option.architectures;
  }

  async loadIndexes(option?: LoadOption) {
    const release = this.metadata;
    const components = this.components.filter((item) =>
      release.components.includes(item)
    );
    const architectures =
      this.architectures && this.architectures.length
        ? this.architectures.filter((item) =>
            release.architectures.includes(item)
          )
        : release.architectures;
    const archives =
      this.type == "deb"
        ? architectures.map((item) => `binary-${item}`)
        : ["source"];
    const indexes = components.flatMap((component) =>
      archives.map((archive) => `${component}/${archive}`)
    );
    const downloadMetadata = <T extends string>(item: string) => {
      const { gzip, hash } = findItemHash(release.hash, item);
      return fetchAndCacheMetadata<T>(
        `${this.url}/dists/${this.distribution}/${item}`,
        {
          gzip,
          hash,
          cacheDir: option?.cacheDir,
          cacheIndex: option?.cacheIndex,
        }
      );
    };
    const data = await Promise.all(
      indexes.map(async (item) => {
        const release = await downloadMetadata<PackageReleaseKey>(
          `${item}/Release`
        );
        const packages = await downloadMetadata<PackageKey>(`${item}/Packages`);
        return { release: release[0], packages };
      })
    );
    this.indexes = data.flatMap(({ release, packages }) => {
      const metadata: IPackageRelease = {
        version: release.Version,
        component: release.Component,
        origin: release.Origin,
        label: release.Label,
        architecture: release.Architecture,
        description: release.Description,
      };
      return packages
        .filter((item) => item.Package != null)
        .map((item) => ({
          repository: this,
          metadata,
          description: item.Description,
          package: item.Package,
          provides: item.Provides?.split(",").map((x) => x.trim()),
          source: item.Source,
          version: item.Version,
          architecture: item.Architecture,
          maintainer: item.Maintainer,
          priority: item.Priority,
          section: item.Section,
          filename: item.Filename,
          size: +(item.Size ?? 0),
          depends: item.Depends?.split(",").map((x) => x.trim()),
          hash: parsePackageHash(item),
        }));
    });
    return this.indexes;
  }
  async loadMetadata(option?: LoadOption) {
    const release = (
      await fetchAndCacheMetadata<ReleaseKey>(
        `${this.url}/dists/${this.distribution}/Release`,
        {
          gzip: true,
          cacheDir: option?.cacheDir,
          cacheIndex: option?.cacheIndex,
        }
      )
    )[0];
    const hash = Object.entries({
      md5: release.MD5Sum,
      sha1: release.SHA1,
      sha256: release.SHA256,
    })
      .filter(([_, value]) => value != null)
      .flatMap(([type, value]) =>
        value
          .split("\n")
          .map((item) => {
            const match = /^(\w+)\s+(\d+)\s+(.+)$/.exec(item);
            if (!match) {
              return null;
            }
            return {
              type,
              hash: match[1],
              size: +match[2],
              path: match[3],
            };
          })
          .filter((x) => x != null)
      );
    this.metadata = {
      codename: release.Codename,
      origin: release.Origin,
      label: release.Label,
      version: release.Version,
      date: release.Date,
      architectures: release.Architectures.split(/\s+/),
      components: release.Components.split(/\s+/),
      description: release.Description,
      hash,
    };
    return this.metadata;
  }
}

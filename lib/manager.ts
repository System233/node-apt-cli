// Copyright (c) 2024 System233
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import {
  IPackage,
  IPackageManager,
  IRelease,
  IRepository,
  LoadOption,
  PackageManagerOption,
  PackageSelector,
  ResolveOption,
} from "./interface.js";
import { Repository } from "./repository.js";
import {
  getPackageProvides,
  parsePackageSelect,
  testVersion,
} from "./utils.js";

export class PackageManager implements IPackageManager {
  readonly repository: RepositoryManager;
  indexes: IPackage[];
  constructor(readonly option: PackageManagerOption) {
    this.repository = new RepositoryManager();
  }
  private _resolve(
    selector: string | PackageSelector,
    queue: Set<IPackage>,
    parentArchitecture?: string,
    option?: ResolveOption
  ): IPackage | null {
    if (!selector) {
      return null;
    }
    if (typeof selector == "string") {
      const selectors = parsePackageSelect(selector);
      for (const selector of selectors) {
        const pkg = this._resolve(
          selector,
          queue,
          selector.architecture ?? parentArchitecture,
          option
        );
        if (pkg) {
          return pkg;
        }
      }
      return null;
    }
    const perferencedPackageArch =
      selector.architecture ?? parentArchitecture ?? this.option.architecture;
    const currentSelectedArch = selector.architecture ?? "any";
    let allpkg = this.indexes.filter(
      (x) =>
        (x.package == selector.package ||
          !!getPackageProvides(x).find(
            (item) => item.package == selector.package
          )) &&
        (currentSelectedArch === "any" ||
          x.architecture == perferencedPackageArch)
    );
    if (currentSelectedArch === "any" && perferencedPackageArch) {
      allpkg = allpkg.sort((x, y) => {
        if (x.architecture == y.architecture) {
          return 0;
        }
        if (x.architecture == perferencedPackageArch) {
          return y.architecture != perferencedPackageArch ? -1 : 0;
        }
        return y.architecture == perferencedPackageArch ? 1 : 0;
      });
      // allpkg = [
      //   ...allpkg.filter((x) => x.architecture == perferencedPackageArch),
      //   ...allpkg.filter((x) => x.architecture != perferencedPackageArch),
      // ];
    }
    const pkg =
      allpkg.find(
        (item) =>
          testVersion(item, selector.op, selector) ||
          getPackageProvides(item).find(
            (item) =>
              item.package == selector.package &&
              testVersion(item, selector.op, selector)
          )
      ) ?? null;
    if (
      pkg != null &&
      option?.recursive &&
      !pkg.dependencies &&
      !queue.has(pkg)
    ) {
      queue.add(pkg);
      pkg.dependencies = pkg.depends
        ?.map((item) =>
          this._resolve(
            item,
            queue,
            pkg.architecture == "all"
              ? parentArchitecture
              : pkg.architecture ?? parentArchitecture,
            option
          )
        )
        .filter((x) => x != null);
      queue.delete(pkg);
    }
    if (pkg == null && option?.missing) {
      const version = selector.version ?? `any`;
      return {
        selector: `${selector.op ?? "="}${version}`,
        package: selector.package,
        version,
        architecture: selector.architecture ?? `missing`,
      } as any;
    }
    return pkg
      ? Object.setPrototypeOf({ selector: `=${pkg?.version}` }, pkg)
      : null;
  }
  resolve(
    selector: string | PackageSelector,
    option?: ResolveOption
  ): IPackage | null {
    return this._resolve(selector, new Set(), undefined, option);
  }
  async load() {
    await this.repository.loadMetadataAll(this.option);
    await this.repository.loadIndexesAll(this.option);
    this.indexes = this.repository.data.flatMap((item) => item.indexes);
  }
}

export class RepositoryManager {
  readonly data: Repository[] = [];
  constructor() {}
  create(option: IRepository) {
    const repo = new Repository(option);
    this.add(repo);
    return repo;
  }
  findAll() {
    return this.data;
  }
  metadata(repo: Repository): IRelease {
    return repo.metadata;
  }
  add(repo: Repository) {
    this.data.push(repo);
    return this;
  }
  remove(repo: Repository) {
    this.data.splice(this.data.indexOf(repo), 1);
    return this;
  }

  async loadMetadata(repo: Repository, option?: LoadOption) {
    return await repo.loadMetadata(option);
  }
  async loadIndexes(repo: Repository, option?: LoadOption) {
    return await repo.loadIndexes(option);
  }
  async loadMetadataAll(option?: LoadOption) {
    await Promise.all(this.data.map((item) => this.loadMetadata(item, option)));
  }
  async loadIndexesAll(option?: LoadOption) {
    await Promise.all(this.data.map((item) => this.loadIndexes(item, option)));
  }
}

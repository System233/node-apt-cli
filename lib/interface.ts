// Copyright (c) 2024 System233
// 
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

export interface IPackageHash {
  type: string;
  hash: string;
}
export interface IHash {
  type: string;
  hash: string;
  size: number;
  path: string;
}
export interface IRelease {
  id?: number;
  origin: string;
  label: string;
  codename: string;
  version: string;
  date: string;
  architectures: string[];
  components: string[];
  description: string;
  hash: IHash[];
}
export interface IVersion {
  version: string;
  parsedVersion?: IPackageVersion | null;
}
export interface PackageSelector {
  selector: string;
  package: string;
  architecture: string;
  op: Op;
  version: string;
  parsedVersion?: IPackageVersion | null;
}

export interface IRepository {
  type: "deb" | "deb-src";
  url: string;
  distribution: string;
  components: string[];
  architectures?: string[];
  metadata?: IRelease;
}
export type ReleaseKey =
  | "Origin"
  | "Label"
  | "Codename"
  | "Version"
  | "Date"
  | "Architectures"
  | "Components"
  | "Description"
  | "MD5Sum"
  | "SHA1"
  | "SHA256";

export type PackageKey =
  | "Version"
  | "Description"
  | "SHA1"
  | "SHA256"
  | "Package"
  | "Provides"
  | "Source"
  | "Architecture"
  | "Maintainer"
  | "Depends"
  | "Priority"
  | "Section"
  | "Filename"
  | "Size"
  | "SHA512"
  | "MD5sum";
export type PackageReleaseKey =
  | "Architecture"
  | "Version"
  | "Component"
  | "Origin"
  | "Label"
  | "Description";
export interface IPackageVersion {
  version: string;
  epoch: number;
  upstream_version: string;
  debian_revision: string;
}
export type Op = "<=" | ">=" | "<<" | ">>" | "=";

export type HashType = "md5" | "sha1" | "sha256" | "sha512";

export interface IPackage {
  repository: IRepository;
  package: string;
  provides?: string[];
  source: string;
  version: string;
  architecture: string;
  maintainer: string;
  depends?: string[];
  priority: string;
  section: string;
  filename: string;
  size: number;
  hash: Record<HashType, string>;
  description: string;
  dependencies?: IPackage[];
  metadata: IPackageRelease;
  parsedVersion?: IPackageVersion | null;
}
export interface IPackageRelease {
  version: string;
  component: string;
  origin: string;
  label: string;
  architecture: string;
  description: string;
}
export interface PackageManagerOption {
  architecture?: string;
  cacheDir?: string;
}
export interface LoadOption {
  cacheDir?: string;
}
export interface IPackageManager {}
export interface ResolveOption {
  recursive?: boolean;
  missing?: boolean;
}
export interface PrintOption {
  format: string;
  indent: number;
  unique?: boolean;
}

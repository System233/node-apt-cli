<!--
 Copyright (c) 2024 System233

 This software is released under the MIT License.
 https://opensource.org/licenses/MIT
-->

# APT-CLI

Used to parse the DEB package dependency tree.

## Features

- Specify package repository
- Print dependency tree
- Search for package name by file name [v0.1.0]

## Usage

```sh
$ npx apt-cli -h # or yarn apt-cli -h

Usage: apt-cli [options] <package...>

Options:
  -c, --cache-dir <DIR>           metadata cache path.
  -a, --arch <ARCH>               default architecture. (default: "any")
  --auth-conf <auth.conf>         apt auth.conf configuration.
  --newline <LF>                  format line break markers.
  --cache-index                   cache package indexes.
  --quiet                         no progress bar.
  -e, --entry <ENTRY>             APT source entry. (default: [])
  -f, --entry-file <FILE>         APT sources.list file. (default: [])
  -h, --help                      display help for command

Commands:
  resolve [options] <package...>  Search packages via package selector
  find [options] <regex...>       Find package name by file name like apt-file
  help [command]                  display help for command
```

## Example

```sh
$ yarn apt-cli -r -e "deb https://community-packages.deepin.com/deepin/beige beige main" -c cache -a amd64 resolve apt
 ████████████████████████████████████████ | "https://community-packages.deepin.com/deepin/beige/dists/beige/Release" | 35182/35182
 ████████████████████████████████████████ | "https://community-packages.deepin.com/deepin/beige/dists/beige/main/binary-i386/Release" | 113/113
 ████████████████████████████████████████ | "https://community-packages.deepin.com/deepin/beige/dists/beige/main/binary-i386/Packages.gz" | 8779245/8779245
 ████████████████████████████████████████ | "https://community-packages.deepin.com/deepin/beige/dists/beige/main/binary-arm64/Release" | 114/114
 ████████████████████████████████████████ | "https://community-packages.deepin.com/deepin/beige/dists/beige/main/binary-arm64/Packages.gz" | 9404486/9404486
 ████████████████████████████████████████ | "https://community-packages.deepin.com/deepin/beige/dists/beige/main/binary-loong64/Release" | 116/116
 ████████████████████████████████████████ | "https://community-packages.deepin.com/deepin/beige/dists/beige/main/binary-riscv64/Release" | 116/116
 ████████████████████████████████████████ | "https://community-packages.deepin.com/deepin/beige/dists/beige/main/binary-riscv64/Packages.gz" | 9028121/9028121
 ████████████████████████████████████████ | "https://community-packages.deepin.com/deepin/beige/dists/beige/main/binary-amd64/Release" | 114/114
 ████████████████████████████████████████ | "https://community-packages.deepin.com/deepin/beige/dists/beige/main/binary-loong64/Packages.gz" | 8830747/8830747
 ████████████████████████████████████████ | "https://community-packages.deepin.com/deepin/beige/dists/beige/main/binary-amd64/Packages.gz" | 9539308/9539308
apt:amd64 (=2.8.0deepin2)
  base-passwd:amd64 (=3.6.3)
    libc6:amd64 (=2.38-6deepin5)
      libgcc-s1:amd64 (=13.2.0-3deepin3)
        gcc-13-base:amd64 (=13.2.0-3deepin3)
    libdebconfclient0:amd64 (=0.271)
    libselinux1:amd64 (=3.5-1deepin1)
      libpcre2-8-0:amd64 (=10.39-2)
  gpgv:amd64 (=2.4.5-2)
    libassuan0:amd64 (=2.5.6-1)
      libgpg-error0:amd64 (=1.47-3)
    libbz2-1.0:amd64 (=1.0.8-deepin)
    libgcrypt20:amd64 (=1.10.3-2)
    libnpth0:amd64 (=1.6-3)
    zlib1g:amd64 (=1:1.3.dfsg-3)
  libapt-pkg6.0:amd64 (=2.8.0deepin2)
    liblz4-1:amd64 (=1.9.3-deepin)
    liblzma5:amd64 (=5.4.5-0.3)
    libstdc++6:amd64 (=13.2.0-3deepin3)
    libsystemd0:amd64 (=255.2-4)
      libcap2:amd64 (=1:2.44-1)
      libzstd1:amd64 (=1.5.5+dfsg2-2)
    libudev1:amd64 (=255.2-4)
    libxxhash0:amd64 (=0.8.2-2)
  deepin-keyring:all (=2024.01.16)
  libgnutls30:amd64 (=3.7.9-2)
    libgmp10:amd64 (=2:6.3.0+dfsg-2)
    libhogweed6:amd64 (=3.7.3-1)
      libnettle8:amd64 (=3.7.3-1)
    libidn2-0:amd64 (=2.3.2-2)
      libunistring2:amd64 (=0.9.10-6)
    libp11-kit0:amd64 (=0.25.5-2)
      libffi8:amd64 (=3.4.6-1)
    libtasn1-6:amd64 (=4.18.0-4)
  libseccomp2:amd64 (=2.5.4-2deepin1+rb1)
```

## Format

### Resolve

Default: `{package}:{architecture} ({selector})`
Field Ref: `{fieldName}`

See [IPackage](./lib/interface.ts#L96) interface.

### Find

Default: `{package}:{index.architecture}: {path}`
Field Ref: `{fieldName}`

See [IContentItem](./lib/interface.ts#L152) interface.

## License

[MIT LICENSE](./LICENSE)

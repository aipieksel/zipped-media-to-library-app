# Third-party notices — Folio local PNG-to-SVG engines

Prepared from pinned upstream sources on 2026-10-29. This notice accompanies the local tracing runtime distributed with Folio. It does not change any upstream license or certify legal compliance.

## Scope and license selection

The runtime packages are `vtracer-browser` 0.0.3, `imagetracerjs` 1.2.6 and `fit-curve` 0.2.0 (see the additional fitting notice below). The VTracer WebAssembly binding source is pinned to commit `2c137d3b0aa7a0c1f1f27b81981c611803e57597`. Its lockfile includes VTracer 1.0.0-alpha.4, VisionCortex 0.9.3 and the exact Rust package versions listed below.

Where a package explicitly offers MIT as an alternative to Apache-2.0, this notice reproduces its MIT option. Apache-only packages retain the complete Apache-2.0 terms. Supplementary notices, the BSD-2-Clause terms, public-domain/Unlicense text and the additional Unicode-3.0 terms are retained. Identical retained license texts share a section; the component tables map every package to its applicable section. Copyright statements in those sections are copied from the inspected upstream files without replacing their authors or years.

The Rust table conservatively includes all 49 registry packages in the pinned binding lockfile, including build, procedural-macro and test dependencies. Inclusion is attribution coverage, not a claim that every listed dependency survives optimization into the shipped WASM. This is a notice for these tracing dependencies, not an exhaustive binary SBOM or an inventory of the rest of the existing application.

## Pinned source evidence

- Binding lockfile: [Cargo.lock at 2c137d3b0aa7a0c1f1f27b81981c611803e57597](https://github.com/zxdstyle/vtracer-browser/blob/2c137d3b0aa7a0c1f1f27b81981c611803e57597/crates/vtracer-wasm/Cargo.lock). SHA-256: `b954953117046e902bcd3fa512004dac665d5fd44b37c0a566369415526e5720`.
- Binding configuration: [Cargo.toml at the same commit](https://github.com/zxdstyle/vtracer-browser/blob/2c137d3b0aa7a0c1f1f27b81981c611803e57597/crates/vtracer-wasm/Cargo.toml).
- Every Rust archive below was fetched from the official crates.io distribution and its SHA-256 was checked against that lockfile. License/notice text and author metadata came from those exact archives; source commits came from their `.cargo_vcs_info.json` where supplied.
- The npm archives were checked against the exact SHA-512 integrity values in Folio’s package-lock.json; their LICENSE bytes also matched the installed pinned packages.
- The shipped `vtracer_bg.wasm` SHA-256 is `4268d8c00ae604d34d41f0aa6470eb447c0b13635275340e0cdd66f950e2068e`. This identifies the inspected npm payload; it is not a reproducible-build attestation.

### Two published-crate omissions

- The `vtracer` 1.0.0-alpha.4 archive declares `MIT OR Apache-2.0` but contains no license file. Its published VCS receipt points to commit `2500df76b5aea0ac22d15296b22722442f825c5b`, path `crates/vtracer`. The [root MIT LICENSE at that exact source commit](https://github.com/visioncortex/vtracer/blob/2500df76b5aea0ac22d15296b22722442f825c5b/LICENSE) is reproduced below, including its original 2024 TSANG, Hao Fung notice.
- The `flo_curves` 0.3.1 archive declares `Apache-2.0` and names Andrew Hunter as author, but contains no LICENSE file; no root LICENSE exists at its published source commit `fccd933942532562557be2a61a706ebc0a1f1888`. Its declared Apache-2.0 terms are represented by the shared complete Apache-2.0 text retained from `flo_curves` 0.8.1. No missing copyright year or license file is fabricated. [Pinned 0.3.1 manifest](https://github.com/Logicalshift/flo_curves/blob/fccd933942532562557be2a61a706ebc0a1f1888/Cargo.toml).

## Runtime packages and binding

| Component | Version | Declared license | Upstream author metadata | Retained notices |
| --- | --- | --- | --- | --- |
| [vtracer-browser](https://registry.npmjs.org/vtracer-browser/-/vtracer-browser-0.0.3.tgz) | 0.0.3 | MIT | zxdstyle | [L01](#license-l01) |
| [imagetracerjs](https://registry.npmjs.org/imagetracerjs/-/imagetracerjs-1.2.6.tgz) | 1.2.6 | Unlicense | András Jankovics | [L02](#license-l02) |
| [vtracer-wasm](https://github.com/zxdstyle/vtracer-browser/blob/2c137d3b0aa7a0c1f1f27b81981c611803e57597/crates/vtracer-wasm/Cargo.toml) | 0.1.0 | MIT OR Apache-2.0 | zxdstyle | [L01](#license-l01) |

| npm archive | SHA-256 | SHA-512 integrity |
| --- | --- | --- |
| vtracer-browser 0.0.3 | `d6da81a6889442ac568ea86574bcf194edc9497b133b0221915dffb39ebf2525` | `sha512-dgqvxl9NpwA8OByM1GyulQGnC2tI4dJznLvZW9bBdDbuSpg/S5CujVjNgkAQl51cWcj4Vx/VVgb/bk6aTO5Emg==` |
| imagetracerjs 1.2.6 | `bf25c789f213869b8df1a577c2cada6a4c307ecf239857ee21150d0eeca80bab` | `sha512-LKJlnKmXFzDdh6IZtXTyBxXcCLTAkwgKYS+NMiPXiXVnlTLjQC8fq7U89laUSgHtypJB3TdMMDK4ecG5NI/Cgw==` |

The published browser wrapper repository metadata uses `https://github.com/zxdstyle/vtracer.git`; the inspected binding source is available through the pinned `zxdstyle/vtracer-browser` source URL above. ImageTracer’s upstream project is [jankovicsandras/imagetracerjs](https://github.com/jankovicsandras/imagetracerjs).

## Pinned Rust package attribution map

The author column preserves the author metadata declared in each published package. Some upstream MIT license files contain no explicit copyright-author line; this table does not invent one in the reproduced license.

| Package | Version | Declared license | Published author metadata | Retained notices |
| --- | --- | --- | --- | --- |
| [aliasable](https://crates.io/api/v1/crates/aliasable/0.1.3/download) | 0.1.3 | MIT | avitex &lt;avitex@wfxlabs.com&gt; | [L03](#license-l03) |
| [autocfg](https://crates.io/api/v1/crates/autocfg/1.5.1/download) | 1.5.1 | Apache-2.0 OR MIT | Josh Stone &lt;cuviper@gmail.com&gt; | [L04](#license-l04) |
| [bit-vec](https://crates.io/api/v1/crates/bit-vec/0.6.3/download) | 0.6.3 | MIT/Apache-2.0 | Alexis Beingessner &lt;a.beingessner@gmail.com&gt; | [L05](#license-l05) |
| [bumpalo](https://crates.io/api/v1/crates/bumpalo/3.20.3/download) | 3.20.3 | MIT OR Apache-2.0 | Nick Fitzgerald &lt;fitzgen@gmail.com&gt; | [L06](#license-l06) |
| [cfg-if](https://crates.io/api/v1/crates/cfg-if/1.0.4/download) | 1.0.4 | MIT OR Apache-2.0 | Alex Crichton &lt;alex@alexcrichton.com&gt; | [L07](#license-l07) |
| [console_error_panic_hook](https://crates.io/api/v1/crates/console_error_panic_hook/0.1.7/download) | 0.1.7 | Apache-2.0/MIT | Nick Fitzgerald &lt;fitzgen@gmail.com&gt; | [L08](#license-l08) |
| [either](https://crates.io/api/v1/crates/either/1.18.0/download) | 1.18.0 | MIT OR Apache-2.0 | Not supplied in the published manifest | [L09](#license-l09) |
| [flo_curves](https://crates.io/api/v1/crates/flo_curves/0.3.1/download) | 0.3.1 | Apache-2.0 | Andrew Hunter | [L10](#license-l10) |
| [flo_curves](https://crates.io/api/v1/crates/flo_curves/0.8.1/download) | 0.8.1 | Apache-2.0 | Andrew Hunter | [L10](#license-l10) |
| [futures-core](https://crates.io/api/v1/crates/futures-core/0.3.34/download) | 0.3.34 | MIT OR Apache-2.0 | Not supplied in the published manifest | [L11](#license-l11) |
| [futures-task](https://crates.io/api/v1/crates/futures-task/0.3.34/download) | 0.3.34 | MIT OR Apache-2.0 | Not supplied in the published manifest | [L11](#license-l11) |
| [futures-util](https://crates.io/api/v1/crates/futures-util/0.3.34/download) | 0.3.34 | MIT OR Apache-2.0 | Not supplied in the published manifest | [L11](#license-l11) |
| [heck](https://crates.io/api/v1/crates/heck/0.4.1/download) | 0.4.1 | MIT OR Apache-2.0 | Without Boats &lt;woboats@gmail.com&gt; | [L05](#license-l05) |
| [itertools](https://crates.io/api/v1/crates/itertools/0.14.0/download) | 0.14.0 | MIT OR Apache-2.0 | bluss | [L09](#license-l09) |
| [itertools](https://crates.io/api/v1/crates/itertools/0.8.2/download) | 0.8.2 | MIT/Apache-2.0 | bluss | [L09](#license-l09) |
| [itoa](https://crates.io/api/v1/crates/itoa/1.0.18/download) | 1.0.18 | MIT OR Apache-2.0 | David Tolnay &lt;dtolnay@gmail.com&gt; | [L12](#license-l12) |
| [js-sys](https://crates.io/api/v1/crates/js-sys/0.3.105/download) | 0.3.105 | MIT OR Apache-2.0 | The wasm-bindgen Developers | [L07](#license-l07) |
| [memchr](https://crates.io/api/v1/crates/memchr/2.8.3/download) | 2.8.3 | Unlicense OR MIT | Andrew Gallant &lt;jamslam@gmail.com&gt;; bluss | [L13](#license-l13), [L14](#license-l14), [L15](#license-l15) |
| [num-traits](https://crates.io/api/v1/crates/num-traits/0.2.19/download) | 0.2.19 | MIT OR Apache-2.0 | The Rust Project Developers | [L16](#license-l16) |
| [once_cell](https://crates.io/api/v1/crates/once_cell/1.21.4/download) | 1.21.4 | MIT OR Apache-2.0 | Aleksey Kladov &lt;aleksey.kladov@gmail.com&gt; | [L12](#license-l12) |
| [ouroboros](https://crates.io/api/v1/crates/ouroboros/0.18.5/download) | 0.18.5 | MIT OR Apache-2.0 | Josh &lt;someguynamedjosh@github.com&gt; | [L17](#license-l17) |
| [ouroboros_macro](https://crates.io/api/v1/crates/ouroboros_macro/0.18.5/download) | 0.18.5 | MIT OR Apache-2.0 | Josh &lt;someguynamedjosh@github.com&gt; | [L17](#license-l17) |
| [pin-project-lite](https://crates.io/api/v1/crates/pin-project-lite/0.2.17/download) | 0.2.17 | Apache-2.0 OR MIT | Not supplied in the published manifest | [L12](#license-l12) |
| [proc-macro2](https://crates.io/api/v1/crates/proc-macro2/1.0.107/download) | 1.0.107 | MIT OR Apache-2.0 | David Tolnay &lt;dtolnay@gmail.com&gt;; Alex Crichton &lt;alex@alexcrichton.com&gt; | [L12](#license-l12) |
| [proc-macro2-diagnostics](https://crates.io/api/v1/crates/proc-macro2-diagnostics/0.10.1/download) | 0.10.1 | MIT/Apache-2.0 | Sergio Benitez &lt;sb@sergio.bz&gt; | [L18](#license-l18) |
| [quote](https://crates.io/api/v1/crates/quote/1.0.47/download) | 1.0.47 | MIT OR Apache-2.0 | David Tolnay &lt;dtolnay@gmail.com&gt; | [L12](#license-l12) |
| [roots](https://crates.io/api/v1/crates/roots/0.0.6/download) | 0.0.6 | BSD-2-Clause | Mikhail Vorotilov &lt;mikhail.vorotilov@gmail.com&gt; | [L19](#license-l19) |
| [roots](https://crates.io/api/v1/crates/roots/0.0.8/download) | 0.0.8 | BSD-2-Clause | Mikhail Vorotilov &lt;mikhail.vorotilov@gmail.com&gt; | [L19](#license-l19) |
| [rustversion](https://crates.io/api/v1/crates/rustversion/1.0.23/download) | 1.0.23 | MIT OR Apache-2.0 | David Tolnay &lt;dtolnay@gmail.com&gt; | [L12](#license-l12) |
| [serde](https://crates.io/api/v1/crates/serde/1.0.229/download) | 1.0.229 | MIT OR Apache-2.0 | Erick Tryzelaar &lt;erick.tryzelaar@gmail.com&gt;; David Tolnay &lt;dtolnay@gmail.com&gt; | [L12](#license-l12) |
| [serde-wasm-bindgen](https://crates.io/api/v1/crates/serde-wasm-bindgen/0.6.5/download) | 0.6.5 | MIT | Ingvar Stepanyan &lt;me@rreverser.com&gt; | [L20](#license-l20) |
| [serde_core](https://crates.io/api/v1/crates/serde_core/1.0.229/download) | 1.0.229 | MIT OR Apache-2.0 | Erick Tryzelaar &lt;erick.tryzelaar@gmail.com&gt;; David Tolnay &lt;dtolnay@gmail.com&gt; | [L12](#license-l12) |
| [serde_derive](https://crates.io/api/v1/crates/serde_derive/1.0.229/download) | 1.0.229 | MIT OR Apache-2.0 | Erick Tryzelaar &lt;erick.tryzelaar@gmail.com&gt;; David Tolnay &lt;dtolnay@gmail.com&gt; | [L12](#license-l12) |
| [serde_json](https://crates.io/api/v1/crates/serde_json/1.0.151/download) | 1.0.151 | MIT OR Apache-2.0 | Erick Tryzelaar &lt;erick.tryzelaar@gmail.com&gt;; David Tolnay &lt;dtolnay@gmail.com&gt; | [L12](#license-l12) |
| [slab](https://crates.io/api/v1/crates/slab/0.4.12/download) | 0.4.12 | MIT | Carl Lerche &lt;me@carllerche.com&gt; | [L21](#license-l21) |
| [smallvec](https://crates.io/api/v1/crates/smallvec/1.16.1/download) | 1.16.1 | MIT OR Apache-2.0 | The Servo Project Developers | [L22](#license-l22) |
| [static_assertions](https://crates.io/api/v1/crates/static_assertions/1.1.0/download) | 1.1.0 | MIT OR Apache-2.0 | Nikolai Vazquez | [L23](#license-l23) |
| [syn](https://crates.io/api/v1/crates/syn/2.0.119/download) | 2.0.119 | MIT OR Apache-2.0 | David Tolnay &lt;dtolnay@gmail.com&gt; | [L12](#license-l12) |
| [syn](https://crates.io/api/v1/crates/syn/3.0.5/download) | 3.0.5 | MIT OR Apache-2.0 | David Tolnay &lt;dtolnay@gmail.com&gt; | [L12](#license-l12) |
| [unicode-ident](https://crates.io/api/v1/crates/unicode-ident/1.0.24/download) | 1.0.24 | (MIT OR Apache-2.0) AND Unicode-3.0 | David Tolnay &lt;dtolnay@gmail.com&gt; | [L12](#license-l12), [L24](#license-l24) |
| [version_check](https://crates.io/api/v1/crates/version_check/0.9.5/download) | 0.9.5 | MIT/Apache-2.0 | Sergio Benitez &lt;sb@sergio.bz&gt; | [L25](#license-l25) |
| [visioncortex](https://crates.io/api/v1/crates/visioncortex/0.9.3/download) | 0.9.3 | MIT OR Apache-2.0 | Chris Tsang &lt;tyt2y7@gmail.com&gt; | [L26](#license-l26) |
| [vtracer](https://crates.io/api/v1/crates/vtracer/1.0.0-alpha.4/download) | 1.0.0-alpha.4 | MIT OR Apache-2.0 | Chris Tsang &lt;chris.2y3@outlook.com&gt; | [L27](#license-l27) |
| [wasm-bindgen](https://crates.io/api/v1/crates/wasm-bindgen/0.2.128/download) | 0.2.128 | MIT OR Apache-2.0 | The wasm-bindgen Developers | [L07](#license-l07) |
| [wasm-bindgen-macro](https://crates.io/api/v1/crates/wasm-bindgen-macro/0.2.128/download) | 0.2.128 | MIT OR Apache-2.0 | The wasm-bindgen Developers | [L07](#license-l07) |
| [wasm-bindgen-macro-support](https://crates.io/api/v1/crates/wasm-bindgen-macro-support/0.2.128/download) | 0.2.128 | MIT OR Apache-2.0 | The wasm-bindgen Developers | [L07](#license-l07) |
| [wasm-bindgen-shared](https://crates.io/api/v1/crates/wasm-bindgen-shared/0.2.128/download) | 0.2.128 | MIT OR Apache-2.0 | The wasm-bindgen Developers | [L07](#license-l07) |
| [yansi](https://crates.io/api/v1/crates/yansi/1.0.1/download) | 1.0.1 | MIT OR Apache-2.0 | Sergio Benitez &lt;sb@sergio.bz&gt; | [L28](#license-l28) |
| [zmij](https://crates.io/api/v1/crates/zmij/1.0.23/download) | 1.0.23 | MIT | David Tolnay &lt;dtolnay@gmail.com&gt; | [L12](#license-l12) |

### Archive and source receipts

| Package version | Official archive SHA-256 | Published source commit |
| --- | --- | --- |
| aliasable 0.1.3 | `250f629c0161ad8107cf89319e990051fae62832fd343083bea452d93e2205fd` | [`ddb6958345aae7fef0686f00a592ef37e944a4ad`](https://github.com/avitex/rust-aliasable/tree/ddb6958345aae7fef0686f00a592ef37e944a4ad) |
| autocfg 1.5.1 | `f2032f911046de80f0a198e0901378627c33f59ea0ac00e363d481118bd70a53` | [`2799b09c24e6632f8e653c5cd8fc303e85a906ba`](https://github.com/cuviper/autocfg/tree/2799b09c24e6632f8e653c5cd8fc303e85a906ba) |
| bit-vec 0.6.3 | `349f9b6a179ed607305526ca489b34ad0a41aed5f7980fa90eb03160b69598fb` | [`975189772f60f87ee84b77b8cd648beac6b86703`](https://github.com/contain-rs/bit-vec/tree/975189772f60f87ee84b77b8cd648beac6b86703) |
| bumpalo 3.20.3 | `72f5acc6cb2ba439de613abc23857ec3d78374d8ed5ac84e9d11336e87da8649` | [`84654ace6be4444da3ff102a0a0af3b38c4df4fb`](https://github.com/fitzgen/bumpalo/tree/84654ace6be4444da3ff102a0a0af3b38c4df4fb) |
| cfg-if 1.0.4 | `9330f8b2ff13f34540b44e946ef35111825727b38d33286ef986142615121801` | [`3510ca6abea34cbbc702509a4e50ea9709925eda`](https://github.com/rust-lang/cfg-if/tree/3510ca6abea34cbbc702509a4e50ea9709925eda) |
| console_error_panic_hook 0.1.7 | `a06aeb73f470f66dcdbf7223caeebb85984942f22f1adb2a088cf9668146bbbc` | [`f998b08b76655c16b948fc329c26ba563e9b3384`](https://github.com/rustwasm/console_error_panic_hook/tree/f998b08b76655c16b948fc329c26ba563e9b3384) |
| either 1.18.0 | `252afb9ae5eaa683babdc6a068b3f5726eb19e05070c731f9b2a23a7c3e8ed34` | [`ce6f07fc3d56d6a56ecfc32256d2c33bd0b4ad09`](https://github.com/rayon-rs/either/tree/ce6f07fc3d56d6a56ecfc32256d2c33bd0b4ad09) |
| flo_curves 0.3.1 | `1c227ffb4f98baa9073c033e23243089d0ed3dd1f5cd620894452074db48a29b` | [`fccd933942532562557be2a61a706ebc0a1f1888`](https://github.com/Logicalshift/flo_curves/tree/fccd933942532562557be2a61a706ebc0a1f1888) |
| flo_curves 0.8.1 | `5937462c05a3c43fecd2b0402b995b92888a35cc7dd6ca39306094c9b60a32fd` | [`1f21e6b525269d2538cea351003df8adca6caf3f`](https://github.com/Logicalshift/flo_curves/tree/1f21e6b525269d2538cea351003df8adca6caf3f) |
| futures-core 0.3.34 | `92d699e522242e69e3003b94ecc1f960f3a5e015aa7c5d7486e65ad01dd94f5e` | [`705e6b5c0f06535b1aac1cb1989a172b3d45be8c`](https://github.com/rust-lang/futures-rs/tree/705e6b5c0f06535b1aac1cb1989a172b3d45be8c) |
| futures-task 0.3.34 | `cd417de3d1d015fc3bfd2b1ea46dfc7bab72ef86f1cc7cc9c78e728b34a6d1fd` | [`705e6b5c0f06535b1aac1cb1989a172b3d45be8c`](https://github.com/rust-lang/futures-rs/tree/705e6b5c0f06535b1aac1cb1989a172b3d45be8c) |
| futures-util 0.3.34 | `0d50a92467f8ba5dd6e3ee5d4bd04d73ab2e4e1c44474a0674821dfce14b79bc` | [`705e6b5c0f06535b1aac1cb1989a172b3d45be8c`](https://github.com/rust-lang/futures-rs/tree/705e6b5c0f06535b1aac1cb1989a172b3d45be8c) |
| heck 0.4.1 | `95505c38b4572b2d910cecb0281560f54b440a19336cbbcb27bf6ce6adc6f5a8` | [`76a8274f948fbe3551413dc09026b733aca71995`](https://github.com/withoutboats/heck/tree/76a8274f948fbe3551413dc09026b733aca71995) |
| itertools 0.14.0 | `2b192c782037fadd9cfa75548310488aabdbf3d2da73885b31bd0abd03351285` | [`a015a6831525ee1637df747d3f530a627d9741bf`](https://github.com/rust-itertools/itertools/tree/a015a6831525ee1637df747d3f530a627d9741bf) |
| itertools 0.8.2 | `f56a2d0bc861f9165be4eb3442afd3c236d8a98afd426f65d92324ae1091a484` | [`dd7fd96b3246f607825420f12141ebd1e0c4185a`](https://github.com/bluss/rust-itertools/tree/dd7fd96b3246f607825420f12141ebd1e0c4185a) |
| itoa 1.0.18 | `8f42a60cbdf9a97f5d2305f08a87dc4e09308d1276d28c869c684d7777685682` | [`af77385d0daf4d0e949e81f2588be2e44f69f086`](https://github.com/dtolnay/itoa/tree/af77385d0daf4d0e949e81f2588be2e44f69f086) |
| js-sys 0.3.105 | `ce57d20d1ea864ce2ac172ab472d409214f4fd359f0b2a2775abdf522e2af99e` | [`246946fddd62163e778c3a1f6afe7264347adceb`](https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/js-sys/tree/246946fddd62163e778c3a1f6afe7264347adceb) |
| memchr 2.8.3 | `cf8baf1c55e62ffcace7a9f06f4bd9cd3f0c4beb022d3b367256b91b87513d98` | [`5fdb40c054e1fff359a2f7bdf7f87a13b34b465d`](https://github.com/BurntSushi/memchr/tree/5fdb40c054e1fff359a2f7bdf7f87a13b34b465d) |
| num-traits 0.2.19 | `071dfc062690e90b734c0b2273ce72ad0ffa95f0c74596bc250dcfd960262841` | [`7ec3d41d39b28190ec1d42db38021107b3951f3a`](https://github.com/rust-num/num-traits/tree/7ec3d41d39b28190ec1d42db38021107b3951f3a) |
| once_cell 1.21.4 | `9f7c3e4beb33f85d45ae3e3a1792185706c8e16d043238c593331cc7cd313b50` | [`80fe900b21f6d76c1a2ed74d3343e8a3a88c46d0`](https://github.com/matklad/once_cell/tree/80fe900b21f6d76c1a2ed74d3343e8a3a88c46d0) |
| ouroboros 0.18.5 | `1e0f050db9c44b97a94723127e6be766ac5c340c48f2c4bb3ffa11713744be59` | [`a8cd334fbb25e6559ed5343e7826d283d0ac001c`](https://github.com/someguynamedjosh/ouroboros/tree/a8cd334fbb25e6559ed5343e7826d283d0ac001c) |
| ouroboros_macro 0.18.5 | `3c7028bdd3d43083f6d8d4d5187680d0d3560d54df4cc9d752005268b41e64d0` | [`a8cd334fbb25e6559ed5343e7826d283d0ac001c`](https://github.com/someguynamedjosh/ouroboros/tree/a8cd334fbb25e6559ed5343e7826d283d0ac001c) |
| pin-project-lite 0.2.17 | `a89322df9ebe1c1578d689c92318e070967d1042b512afbe49518723f4e6d5cd` | [`3bdf763446aa78f90e3bdac1ef583e014832ab4c`](https://github.com/taiki-e/pin-project-lite/tree/3bdf763446aa78f90e3bdac1ef583e014832ab4c) |
| proc-macro2 1.0.107 | `985e7ec9bb745e6ce6535b544d84d6cd6f7ad8bd711c398938ae983b91a766d9` | [`ed8a5497669cd63db33bf24646f261b012bbbc4a`](https://github.com/dtolnay/proc-macro2/tree/ed8a5497669cd63db33bf24646f261b012bbbc4a) |
| proc-macro2-diagnostics 0.10.1 | `af066a9c399a26e020ada66a034357a868728e72cd426f3adcd35f80d88d88c8` | [`45fa2d68669d10daeaf0f9b664a96576626fae16`](https://github.com/SergioBenitez/proc-macro2-diagnostics/tree/45fa2d68669d10daeaf0f9b664a96576626fae16) |
| quote 1.0.47 | `1fbf4db142a473a8d80c26bbf18454ed458bf8d26c8219c331daecfdbd079001` | [`723dcb47d3f0ddc896e17287c8a8d3f2ea2317d5`](https://github.com/dtolnay/quote/tree/723dcb47d3f0ddc896e17287c8a8d3f2ea2317d5) |
| roots 0.0.6 | `84348444bd7ad45729d0c49a4240d7cdc11c9d512c06c5ad1835c1ad4acda6db` | [`d086482984f5cf6704130aa181ba4efaf87dadb5`](https://github.com/vorot/roots/tree/d086482984f5cf6704130aa181ba4efaf87dadb5) |
| roots 0.0.8 | `082f11ffa03bbef6c2c6ea6bea1acafaade2fd9050ae0234ab44a2153742b058` | [`3caf9740f66aa213468136dea7a59d04a33cc0a7`](https://github.com/vorot/roots/tree/3caf9740f66aa213468136dea7a59d04a33cc0a7) |
| rustversion 1.0.23 | `cf54715a573b99ac80df0bc206da022bcd442c974952c7b9720069370852e21f` | [`3a7c76605450b9a7299c6502a421909de9126a59`](https://github.com/dtolnay/rustversion/tree/3a7c76605450b9a7299c6502a421909de9126a59) |
| serde 1.0.229 | `4148590afebada386688f18773da617792bf2ef03ffc1e4cbd2b1d45b023e0ba` | [`7fc3b4c30c94f73a96ebd1553f2b090d928fc3a8`](https://github.com/serde-rs/serde/tree/7fc3b4c30c94f73a96ebd1553f2b090d928fc3a8) |
| serde-wasm-bindgen 0.6.5 | `8302e169f0eddcc139c70f139d19d6467353af16f9fce27e8c30158036a1e16b` | [`f073bd40ee5a354e3e9e2ac376300368d28067fe`](https://github.com/RReverser/serde-wasm-bindgen/tree/f073bd40ee5a354e3e9e2ac376300368d28067fe) |
| serde_core 1.0.229 | `67dca2c9c51e58a4791a4b1ed58308b39c64224d349a935ab5039aa360942a48` | [`7fc3b4c30c94f73a96ebd1553f2b090d928fc3a8`](https://github.com/serde-rs/serde/tree/7fc3b4c30c94f73a96ebd1553f2b090d928fc3a8) |
| serde_derive 1.0.229 | `e7a5d71263a5a7d47b41f6b3f06ba276f10cc18b0931f1799f710578e2309348` | [`7fc3b4c30c94f73a96ebd1553f2b090d928fc3a8`](https://github.com/serde-rs/serde/tree/7fc3b4c30c94f73a96ebd1553f2b090d928fc3a8) |
| serde_json 1.0.151 | `c841b55ecdae098c80dcae9cf767f6f8a0c2cdb3416bbef72181df4d0fe73f14` | [`de8500740cdcabffb9734f503e4889def823cf10`](https://github.com/serde-rs/json/tree/de8500740cdcabffb9734f503e4889def823cf10) |
| slab 0.4.12 | `0c790de23124f9ab44544d7ac05d60440adc586479ce501c1d6d7da3cd8c9cf5` | [`a1e4346070a48c936d808de75191dee5d01e433c`](https://github.com/tokio-rs/slab/tree/a1e4346070a48c936d808de75191dee5d01e433c) |
| smallvec 1.16.1 | `ba467056f1b547ed52077911161fc86985becbc60e8e1857c8a144dab0def891` | [`700e1c3ff899cda7799b18e0804889105fc8beea`](https://github.com/servo/rust-smallvec/tree/700e1c3ff899cda7799b18e0804889105fc8beea) |
| static_assertions 1.1.0 | `a2eb9349b6444b326872e140eb1cf5e7c522154d69e7a0ffb0fb81c06b37543f` | [`18bc65a094d890fe1faa5d3ccb70f12b89eabf56`](https://github.com/nvzqz/static-assertions-rs/tree/18bc65a094d890fe1faa5d3ccb70f12b89eabf56) |
| syn 2.0.119 | `872831b642d1a07999a962a351ed35b955ea2cfc8f3862091e2a240a84f17297` | [`3295f9e9841785ac88a5e558c884854d5fb7d67f`](https://github.com/dtolnay/syn/tree/3295f9e9841785ac88a5e558c884854d5fb7d67f) |
| syn 3.0.5 | `12df2e0110f65b775f769bb17ef989067a1d931b2eb822bd4346631eeada89f9` | [`e0ad92d68b588c964e82bb74c3bd3e1e99f97ceb`](https://github.com/dtolnay/syn/tree/e0ad92d68b588c964e82bb74c3bd3e1e99f97ceb) |
| unicode-ident 1.0.24 | `e6e4313cd5fcd3dad5cafa179702e2b244f760991f45397d14d4ebf38247da75` | [`5b54a632702b5744a1c40ea01c127c0ac0498172`](https://github.com/dtolnay/unicode-ident/tree/5b54a632702b5744a1c40ea01c127c0ac0498172) |
| version_check 0.9.5 | `0b928f33d975fc6ad9f86c8f283853ad26bdd5b10b7f1542aa2fa15e2289105a` | [`d77ef9f27cc336719b2d839d09ee6635dd22f758`](https://github.com/SergioBenitez/version_check/tree/d77ef9f27cc336719b2d839d09ee6635dd22f758) |
| visioncortex 0.9.3 | `84af9c2ece99261bf0a14cff5162221350b7288e33a78534017ebf07c9389bff` | [`0062088c89645aac76c00e066deb7e8f53980dd7`](https://github.com/visioncortex/visioncortex/tree/0062088c89645aac76c00e066deb7e8f53980dd7) |
| vtracer 1.0.0-alpha.4 | `cac269b3a4a6dc1571cc35955633e9ac8fcd2a2e8f9b77105676b15181e6453c` | [`2500df76b5aea0ac22d15296b22722442f825c5b`](https://github.com/visioncortex/vtracer/tree/2500df76b5aea0ac22d15296b22722442f825c5b) |
| wasm-bindgen 0.2.128 | `aecb87a33d3b0c5e3b7aa46336eaf486cffafbd281b195e4c8b80d50df2351bf` | [`246946fddd62163e778c3a1f6afe7264347adceb`](https://github.com/wasm-bindgen/wasm-bindgen/tree/246946fddd62163e778c3a1f6afe7264347adceb) |
| wasm-bindgen-macro 0.2.128 | `a690d511e3c1a8b3a55e33511e3c2c00c78415cd23650f32b808627f5696b9ed` | [`246946fddd62163e778c3a1f6afe7264347adceb`](https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/macro/tree/246946fddd62163e778c3a1f6afe7264347adceb) |
| wasm-bindgen-macro-support 0.2.128 | `411e4887f0071ef2d2164a9d5fdf2d20efbef78fccd3a78b0c10a1dc5295e48a` | [`246946fddd62163e778c3a1f6afe7264347adceb`](https://github.com/wasm-bindgen/wasm-bindgen/tree/main/crates/macro-support/tree/246946fddd62163e778c3a1f6afe7264347adceb) |
| wasm-bindgen-shared 0.2.128 | `81941cd78d0c92026c33e5e01312845a4cb1e9af3407f9134b100dd03144103e` | [`246946fddd62163e778c3a1f6afe7264347adceb`](https://github.com/wasm-bindgen/wasm-bindgen/tree/master/crates/shared/tree/246946fddd62163e778c3a1f6afe7264347adceb) |
| yansi 1.0.1 | `cfe53a6657fd280eaa890a3bc59152892ffa3e30101319d168b781ed6529b049` | [`3e35184fc181fef63bc11dedb22413e821168255`](https://github.com/SergioBenitez/yansi/tree/3e35184fc181fef63bc11dedb22413e821168255) |
| zmij 1.0.23 | `29666d0abbfad1e3dc4dcf6144730dd3a3ab225bbbdac83319345b1b44ccfc1b` | [`7b7cc48b58028e8af7be87e94c0c1c8936f1a57c`](https://github.com/dtolnay/zmij/tree/7b7cc48b58028e8af7be87e94c0c1c8936f1a57c) |

## Retained license and notice texts

The following texts are reproduced from the sources identified above. Formatting inside each block follows the retained upstream text. A final display newline before a Markdown fence is not part of the upstream hash.

## License L01

Retained text SHA-256: `2420109dfe8e22f6f552de4548cce03fa8bf3f98f7c4b8976b56995e0838fd04`.

Applies to:

- vtracer-browser 0.0.3 — package/LICENSE
- vtracer-wasm 0.1.0 — repository LICENSE (MIT option)

```text
MIT License

Copyright (c) 2026 zxdstyle

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## License L02

Retained text SHA-256: `60d2c28d19d2bdf7bbaa59829e7a595234265e8111a01ccb74d25d6c4d2d013a`.

Applies to:

- imagetracerjs 1.2.6 — package/LICENSE

```text
This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <http://unlicense.org>
```

## License L03

Retained text SHA-256: `b6e8f9bd07084b3ed3a061cd0e9f0c5d5fb46667ef007684c87573a7c8090a34`.

Applies to:

- aliasable 0.1.3 — LICENSE

```text
The MIT License (MIT)

Copyright (c) 2020 James Dyson <avitex@wfxlabs.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## License L04

Retained text SHA-256: `27995d58ad5c1145c1a8cd86244ce844886958a35eb2b78c6b772748669999ac`.

Applies to:

- autocfg 1.5.1 — LICENSE-MIT

```text
Copyright (c) 2018 Josh Stone

Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```

## License L05

Retained text SHA-256: `7b63ecd5f1902af1b63729947373683c32745c16a10e8e6292e2e2dcd7e90ae0`.

Applies to:

- bit-vec 0.6.3 — LICENSE-MIT
- heck 0.4.1 — LICENSE-MIT

```text
Copyright (c) 2015 The Rust Project Developers

Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```

## License L06

Retained text SHA-256: `65f94e99ddaf4f5d1782a6dae23f35d4293a9a01444a13135a6887017d353cee`.

Applies to:

- bumpalo 3.20.3 — LICENSE-MIT

```text
Copyright (c) 2019 Nick Fitzgerald

Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```

## License L07

Retained text SHA-256: `378f5840b258e2779c39418f3f2d7b2ba96f1c7917dd6be0713f88305dbda397`.

Applies to:

- cfg-if 1.0.4 — LICENSE-MIT
- js-sys 0.3.105 — LICENSE-MIT
- wasm-bindgen 0.2.128 — LICENSE-MIT
- wasm-bindgen-macro 0.2.128 — LICENSE-MIT
- wasm-bindgen-macro-support 0.2.128 — LICENSE-MIT
- wasm-bindgen-shared 0.2.128 — LICENSE-MIT

```text
Copyright (c) 2014 Alex Crichton

Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```

## License L08

Retained text SHA-256: `77674336af8ded214dc3ae07da631c7dd35cc8205f39298474ba98a889e57272`.

Applies to:

- console_error_panic_hook 0.1.7 — LICENSE-MIT

```text
Copyright (c) 2018 Nick Fitzgerald

Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```

## License L09

Retained text SHA-256: `7576269ea71f767b99297934c0b2367532690f8c4badc695edf8e04ab6a1e545`.

Applies to:

- either 1.18.0 — LICENSE-MIT
- itertools 0.14.0 — LICENSE-MIT
- itertools 0.8.2 — LICENSE-MIT

```text
Copyright (c) 2015

Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```

## License L10

Retained text SHA-256: `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30`.

Applies to:

- flo_curves 0.3.1 — Apache-2.0 declared by pinned Cargo.toml; shared license text
- flo_curves 0.8.1 — LICENSE

```text

                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright [yyyy] [name of copyright owner]

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

## License L11

Retained text SHA-256: `6652c868f35dfe5e8ef636810a4e576b9d663f3a17fb0f5613ad73583e1b88fd`.

Applies to:

- futures-core 0.3.34 — LICENSE-MIT
- futures-task 0.3.34 — LICENSE-MIT
- futures-util 0.3.34 — LICENSE-MIT

```text
Copyright (c) 2016 Alex Crichton
Copyright (c) 2017 The Tokio Authors

Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```

## License L12

Retained text SHA-256: `23f18e03dc49df91622fe2a76176497404e46ced8a715d9d2b67a7446571cca3`.

Applies to:

- itoa 1.0.18 — LICENSE-MIT
- once_cell 1.21.4 — LICENSE-MIT
- pin-project-lite 0.2.17 — LICENSE-MIT
- proc-macro2 1.0.107 — LICENSE-MIT
- quote 1.0.47 — LICENSE-MIT
- rustversion 1.0.23 — LICENSE-MIT
- serde 1.0.229 — LICENSE-MIT
- serde_core 1.0.229 — LICENSE-MIT
- serde_derive 1.0.229 — LICENSE-MIT
- serde_json 1.0.151 — LICENSE-MIT
- syn 2.0.119 — LICENSE-MIT
- syn 3.0.5 — LICENSE-MIT
- unicode-ident 1.0.24 — LICENSE-MIT
- zmij 1.0.23 — LICENSE-MIT

```text
Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```

## License L13

Retained text SHA-256: `01c266bced4a434da0051174d6bee16a4c82cf634e2679b6155d40d75012390f`.

Applies to:

- memchr 2.8.3 — COPYING

```text
This project is dual-licensed under the Unlicense and MIT licenses.

You may use this code under the terms of either license.
```

## License L14

Retained text SHA-256: `0f96a83840e146e43c0ec96a22ec1f392e0680e6c1226e6f3ba87e0740af850f`.

Applies to:

- memchr 2.8.3 — LICENSE-MIT

```text
The MIT License (MIT)

Copyright (c) 2015 Andrew Gallant

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## License L15

Retained text SHA-256: `7e12e5df4bae12cb21581ba157ced20e1986a0508dd10d0e8a4ab9a4cf94e85c`.

Applies to:

- memchr 2.8.3 — UNLICENSE

```text
This is free and unencumbered software released into the public domain.

Anyone is free to copy, modify, publish, use, compile, sell, or
distribute this software, either in source code form or as a compiled
binary, for any purpose, commercial or non-commercial, and by any
means.

In jurisdictions that recognize copyright laws, the author or authors
of this software dedicate any and all copyright interest in the
software to the public domain. We make this dedication for the benefit
of the public at large and to the detriment of our heirs and
successors. We intend this dedication to be an overt act of
relinquishment in perpetuity of all present and future rights to this
software under copyright law.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR
OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.

For more information, please refer to <http://unlicense.org/>
```

## License L16

Retained text SHA-256: `6485b8ed310d3f0340bf1ad1f47645069ce4069dcc6bb46c7d5c6faf41de1fdb`.

Applies to:

- num-traits 0.2.19 — LICENSE-MIT

```text
Copyright (c) 2014 The Rust Project Developers

Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```

## License L17

Retained text SHA-256: `b87740f87cbb0e8be9c4c21db4a265d5f297cd9ee3ea0ff4cf702de819ef6de7`.

Applies to:

- ouroboros 0.18.5 — LICENSE_MIT
- ouroboros_macro 0.18.5 — LICENSE_MIT

```text
MIT License

Copyright (c) 2021 Josh

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## License L18

Retained text SHA-256: `38176bb6aad910a449a304967836091da15384cdb73c7477d805b1f6045d14d6`.

Applies to:

- proc-macro2-diagnostics 0.10.1 — LICENSE-MIT

```text
The MIT License (MIT)
Copyright (c) 2016-2020 Sergio Benitez

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## License L19

Retained text SHA-256: `30046c1fdb02876290d416ca87f9e0bbe703fab78f72a23400d0145c116ad514`.

Applies to:

- roots 0.0.6 — LICENSE
- roots 0.0.8 — LICENSE

```text
Copyright (c) 2015, Mikhail Vorotilov
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## License L20

Retained text SHA-256: `62a81c033fcf173693b50f068939cd903d8a414d915776ff1fef5d5869aabcb7`.

Applies to:

- serde-wasm-bindgen 0.6.5 — LICENSE

```text
MIT License

Copyright (c) 2019 Cloudflare, Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## License L21

Retained text SHA-256: `8ce0830173fdac609dfb4ea603fdc002c2f4af0dc9b1a005653f5da9cf534b18`.

Applies to:

- slab 0.4.12 — LICENSE

```text
Copyright (c) 2019 Carl Lerche

Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```

## License L22

Retained text SHA-256: `0b28172679e0009b655da42797c03fd163a3379d5cfa67ba1f1655e974a2a1a9`.

Applies to:

- smallvec 1.16.1 — LICENSE-MIT

```text
Copyright (c) 2018 The Servo Project Developers

Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```

## License L23

Retained text SHA-256: `ea084a2373ebc1f0902c09266e7bf25a05ab3814c1805bb017ffa7308f90c061`.

Applies to:

- static_assertions 1.1.0 — LICENSE-MIT

```text
MIT License

Copyright (c) 2017 Nikolai Vazquez

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## License L24

Retained text SHA-256: `f7db81051789b729fea528a63ec4c938fdcb93d9d61d97dc8cc2e9df6d47f2a1`.

Applies to:

- unicode-ident 1.0.24 — LICENSE-UNICODE

```text
UNICODE LICENSE V3

COPYRIGHT AND PERMISSION NOTICE

Copyright © 1991-2023 Unicode, Inc.

NOTICE TO USER: Carefully read the following legal agreement. BY
DOWNLOADING, INSTALLING, COPYING OR OTHERWISE USING DATA FILES, AND/OR
SOFTWARE, YOU UNEQUIVOCALLY ACCEPT, AND AGREE TO BE BOUND BY, ALL OF THE
TERMS AND CONDITIONS OF THIS AGREEMENT. IF YOU DO NOT AGREE, DO NOT
DOWNLOAD, INSTALL, COPY, DISTRIBUTE OR USE THE DATA FILES OR SOFTWARE.

Permission is hereby granted, free of charge, to any person obtaining a
copy of data files and any associated documentation (the "Data Files") or
software and any associated documentation (the "Software") to deal in the
Data Files or Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, and/or sell
copies of the Data Files or Software, and to permit persons to whom the
Data Files or Software are furnished to do so, provided that either (a)
this copyright and permission notice appear with all copies of the Data
Files or Software, or (b) this copyright and permission notice appear in
associated Documentation.

THE DATA FILES AND SOFTWARE ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY
KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF
THIRD PARTY RIGHTS.

IN NO EVENT SHALL THE COPYRIGHT HOLDER OR HOLDERS INCLUDED IN THIS NOTICE
BE LIABLE FOR ANY CLAIM, OR ANY SPECIAL INDIRECT OR CONSEQUENTIAL DAMAGES,
OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,
ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THE DATA
FILES OR SOFTWARE.

Except as contained in this notice, the name of a copyright holder shall
not be used in advertising or otherwise to promote the sale, use or other
dealings in these Data Files or Software without prior written
authorization of the copyright holder.
```

## License L25

Retained text SHA-256: `b7e650f3fce5c53249d1cdc608b54df156a97edd636cf9d23498d0cfe7aec63e`.

Applies to:

- version_check 0.9.5 — LICENSE-MIT

```text
The MIT License (MIT)
Copyright (c) 2017-2018 Sergio Benitez

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## License L26

Retained text SHA-256: `7f6013869a65ec6cb32fb5aface4e0d28b2d0253cababaa200744c3546ba2c9b`.

Applies to:

- visioncortex 0.9.3 — LICENSE-MIT

```text
Copyright (c) 2026 TSANG, Hao Fung

Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```

## License L27

Retained text SHA-256: `81ee739f355765c110fc89feff14ffffce829901f96ba811fd0b65a41a8636c7`.

Applies to:

- vtracer 1.0.0-alpha.4 — repository LICENSE at 2500df76b5aea0ac22d15296b22722442f825c5b (MIT option)

```text
Copyright (c) 2024 TSANG, Hao Fung

Permission is hereby granted, free of charge, to any
person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the
Software without restriction, including without
limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software
is furnished to do so, subject to the following
conditions:

The above copyright notice and this permission notice
shall be included in all copies or substantial portions
of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED
TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT
SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.
```

## License L28

Retained text SHA-256: `ce1f970284c4ab06e90671a984086692dc44da3e2b8ee86444d79b6f77bcf9e7`.

Applies to:

- yansi 1.0.1 — LICENSE-MIT

```text
The MIT License (MIT)
Copyright (c) 2017 Sergio Benitez

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```


## Native alpha contour fitting: fit-curve 0.2.0

The eligible monochrome contour worker also bundles fit-curve 0.2.0 (MIT), upstream https://github.com/soswow/fit-curve. The npm package has no runtime dependencies. The published archive SHA-256 is db5af99ede8211d077835b447ca3a4654f22715362702bd566d27a28fca89908; the lockfile records its SHA-512 integrity. This is an additional component beyond the preceding VTracer/ImageTracer tables. Its exact published LICENSE follows.

```text
The MIT License (MIT)

Copyright (c) 2014 Volker Poplawski

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```


## AI companion and SVG validation additions — 2026-10-31

The owner-supplied `@codraoss/ai-cli-integration` 0.1.0 source is adapted under
AGPL-3.0-only. Its complete license is retained in
[vendor/ai-cli-integration/LICENSE](vendor/ai-cli-integration/LICENSE), with original
README and [modification notice](vendor/ai-cli-integration/FOLIO-CHANGES.md). The
modified corresponding source is in this repository. No prebuilt ZIP code,
credentials, private fixtures or upstream node_modules are included.

Runtime additions are pinned in package-lock.json: `@xmldom/xmldom` 0.9.12 (MIT)
for identical strict XML parsing in browser and companion, and `zod` 4.4.3 (MIT)
for bounded provider/request/result contracts. Their installed release license
texts are retained below. The companion build copies its AGPL notice; source is
available from the repository linked by the app's AI setup.

### @xmldom/xmldom license

```text
Copyright 2019 - present Christopher J. Brody and other contributors, as listed in: https://github.com/xmldom/xmldom/graphs/contributors
Copyright 2012 - 2017 @jindw <jindw@xidea.org> and other contributors, as listed in: https://github.com/jindw/xmldom/graphs/contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

```

### zod license

```text
MIT License

Copyright (c) 2025 Colin McDonnell

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

```


## Revision10 interface and authentication dependencies

Base UI React1.9.0 supplies the unstyled Select primitive; Folio owns its wrapper and CSS. Better Auth1.7.14 supplies the server account/session framework with Folio membership and password hooks. Their exact installed MIT notices are retained below. Drizzle ORM0.45.4 (Apache-2.0), Drizzle Kit0.31.11 (MIT), and Miniflare4.20260730.0 (MIT) are development/migration/verification tooling, pinned in package-lock.json. Existing notices and AGPL package obligations remain in effect.

### Base UI React1.9.0

```text
MIT License

Copyright (c) 2019 Material-UI SAS

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

```

### Better Auth1.7.14

```text
The MIT License (MIT)
Copyright (c) 2024 - present, Bereket Engida

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the “Software”), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.

```


## @noble/hashes 2.4.0

SHA-256 byte verification fallback for browser environments without SubtleCrypto. Source: https://github.com/paulmillr/noble-hashes

The MIT License (MIT)

Copyright (c) 2022 Paul Miller (https://paulmillr.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the “Software”), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

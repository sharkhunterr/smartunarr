# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [0.1.9](https://github.com/sharkhunterr/smartunarr/-/compare/v0.1.8...v0.1.9) (2026-02-04)

### [0.1.8](https://github.com/sharkhunterr/smartunarr/-/compare/v0.1.7...v0.1.8) (2026-02-04)


### Features

* Add service status banner, improve UI consistency, and fix bugs ([bde4e21](https://github.com/sharkhunterr/smartunarr/-/commit/bde4e219c07cb2c428b9b8c3bfe4d0ab34647304))

### [0.1.7](https://github.com/sharkhunterr/smartunarr/-/compare/v0.1.6...v0.1.7) (2026-02-03)


### Bug Fixes

* Use fixed lowercase Docker Hub image name (smartunarr) ([f97a5b5](https://github.com/sharkhunterr/smartunarr/-/commit/f97a5b5f097d7bec6f253be4006851901b930ba5))

### [0.1.6](https://github.com/sharkhunterr/smartunarr/-/compare/v0.1.5...v0.1.6) (2026-02-03)


### Bug Fixes

* Correct health endpoint path in CI (/health not /api/v1/health) ([8e7310f](https://github.com/sharkhunterr/smartunarr/-/commit/8e7310fd7bc9bd03d73b2926b9e2add746145e44))

### [0.1.5](https://github.com/sharkhunterr/smartunarr/-/compare/v0.1.4...v0.1.5) (2026-02-03)


### Bug Fixes

* Run CI pipeline only on tags ([64c47d4](https://github.com/sharkhunterr/smartunarr/-/commit/64c47d41cc511f152b165adae7da0b872849e4f4))
* Use Docker Hub instead of GitLab registry for CI images ([39b8561](https://github.com/sharkhunterr/smartunarr/-/commit/39b856171cce05a2206ef22fd992b1ad250674f1))

### [0.1.4](https://github.com/sharkhunterr/smartunarr/-/compare/v0.1.3...v0.1.4) (2026-02-03)


### Bug Fixes

* Use GitLab registry instead of artifact for Docker image ([5210f02](https://github.com/sharkhunterr/smartunarr/-/commit/5210f02d91fc8036644f3dac9b1f1cebf7ac238d))

### [0.1.3](https://github.com/sharkhunterr/smartunarr/-/compare/v0.1.2...v0.1.3) (2026-02-03)


### Bug Fixes

* Add dev dependencies in Poetry format for CI ([534b263](https://github.com/sharkhunterr/smartunarr/-/commit/534b263d9c7222e714c903ee8ebb018c1907d4b6))

### [0.1.2](https://github.com/sharkhunterr/smartunarr/-/compare/v0.1.1...v0.1.2) (2026-02-03)


### Bug Fixes

* Fix CI configuration for Poetry and correct script paths ([bd9f78c](https://github.com/sharkhunterr/smartunarr/-/commit/bd9f78ccdf35f7a517a82708a17d5ccc5487abd6))

### 0.1.1 (2026-02-03)


### Features

* Add AI profile generation with Ollama integration ([3340a13](https://github.com/sharkhunterr/smartunarr/-/commit/3340a139b32a0ca47b3b0541dd203bba767f735f))
* Add blockbuster v8 profile with time-based genre adaptation ([2a2085c](https://github.com/sharkhunterr/smartunarr/-/commit/2a2085c567f2b1b83bce5632d8550d6414c74f59))
* Add complete profile editor with tabs and modernize profile view ([e336ef1](https://github.com/sharkhunterr/smartunarr/-/commit/e336ef1b136e68d897860859c8b1aff39ee8ece7))
* Add detailed history page with iteration navigation and score tables ([51c3f44](https://github.com/sharkhunterr/smartunarr/-/commit/51c3f444aac23fd2f9ae907ae62bffc0e7969b1c))
* Add history comparison and fix history display issues ([f8a7473](https://github.com/sharkhunterr/smartunarr/-/commit/f8a747355c9d66830226bb91eda97a0e80ca4449))
* Add i18n support for IT, ES, DE and translate comparison components ([85343b9](https://github.com/sharkhunterr/smartunarr/-/commit/85343b91b50d974a060a21999e2cbdc602969ee7))
* Add library selection modal for TMDB sync ([763a809](https://github.com/sharkhunterr/smartunarr/-/commit/763a809c0f65e85a886c45cc41068b9c164bd4f6))
* Add logs page improvements and cache management UI ([8b524dc](https://github.com/sharkhunterr/smartunarr/-/commit/8b524dc5be9d947eedbbe34a5556bd92436a02cc))
* Add per-criterion M/F/P rules and skip timing for middle programs ([847d87e](https://github.com/sharkhunterr/smartunarr/-/commit/847d87e36bb325b9253d9fb02d5952886c0a05c8))
* Add persistent result storage and fix Tunarr programming endpoint ([e6afb0c](https://github.com/sharkhunterr/smartunarr/-/commit/e6afb0c0fe703e1a243de06f2ce8a3b9b8b6465a))
* Add progress steps and replacement info for optimization phases ([ddcd0f0](https://github.com/sharkhunterr/smartunarr/-/commit/ddcd0f0dc6d4702f96f3324136e2da402b4a6a92))
* Add real-time progress indicator for TMDB sync ([c1d33f1](https://github.com/sharkhunterr/smartunarr/-/commit/c1d33f1c2450f741038a0cb267939bd454c58b7a))
* Add refresh cache from Plex button ([8d32cab](https://github.com/sharkhunterr/smartunarr/-/commit/8d32cab30387efe46930d4c1f7a31a2d8751fb32))
* Add scheduling page for automated programming/scoring ([4609e0b](https://github.com/sharkhunterr/smartunarr/-/commit/4609e0b9f321558ca2b2c23fb19cfdc40c2c2494))
* Add TMDB sync button and fix cache display issues ([483b852](https://github.com/sharkhunterr/smartunarr/-/commit/483b852e59d58c714f729c099cc1d85ab91f2f64))
* Add Tunarr channel programming sync ([f385445](https://github.com/sharkhunterr/smartunarr/-/commit/f385445410c35b886b2e00d576aacacf484e6e86))
* Complete i18n translations for all frontend pages ([8ce8e30](https://github.com/sharkhunterr/smartunarr/-/commit/8ce8e30157aad0edc691655da1d7214bc4f95b29))
* Complete project setup with documentation, CI/CD, and branding ([d23947f](https://github.com/sharkhunterr/smartunarr/-/commit/d23947f20b9d11c7dc5b95c82b07b50e059bcca4))
* **experimental:** Add AI-assisted programming improvement ([7749fa9](https://github.com/sharkhunterr/smartunarr/-/commit/7749fa95b7f5b43cdc7c3bfc66d2d36048773349))
* Implement adaptive timing curve with minute-based M/F/P thresholds ([896356b](https://github.com/sharkhunterr/smartunarr/-/commit/896356bf8e33811d8e05473551df0deb4ee7798b))
* Improve logs page UI and filtering ([1137f6e](https://github.com/sharkhunterr/smartunarr/-/commit/1137f6ef8d3a6d5f9d1f0a73b95ae9f886c5d6ea))
* Initial SmartTunarr implementation with scoring system ([4993963](https://github.com/sharkhunterr/smartunarr/-/commit/4993963763772283fac569015768b11e3403ec14))
* Update Tunarr channel startTime and fix score calculation ([5731212](https://github.com/sharkhunterr/smartunarr/-/commit/5731212a38164903fe62a373b8e649548515d038))


### Bug Fixes

* Add SQLite busy_timeout and StaticPool to prevent database locks ([eb1bcf3](https://github.com/sharkhunterr/smartunarr/-/commit/eb1bcf3efbb9983a44043d1ad73f6afcba8bbb9b))
* Correct overnight block datetime calculation for multi-day programming ([ef79387](https://github.com/sharkhunterr/smartunarr/-/commit/ef7938754d7fb2b22c1e23a91c3b9ce0342ff115))
* Correct timezone handling for block timing calculations ([ee7572a](https://github.com/sharkhunterr/smartunarr/-/commit/ee7572af83668a026183930aa346fe702ddf8899))
* Correct Tunarr program format with numeric externalKey ([ea100b3](https://github.com/sharkhunterr/smartunarr/-/commit/ea100b31c5f0cd2065e5cd26b1b290930ec1022c))
* Count only items with tmdb_id as enriched ([ce5c929](https://github.com/sharkhunterr/smartunarr/-/commit/ce5c929f5056ce4f3600daafa91e4a0446f1056c))
* Improve timing scoring and forbidden violation display ([58b76a5](https://github.com/sharkhunterr/smartunarr/-/commit/58b76a5300c7818cda965e2b6813f734a66818e2))
* Move global declaration before variable usage in logs cleanup ([34ea690](https://github.com/sharkhunterr/smartunarr/-/commit/34ea690c9a8b7397d17a6c2a1613d6f29a458867))
* Recalculate timing scores after scheduling and optimizations ([fd4d52c](https://github.com/sharkhunterr/smartunarr/-/commit/fd4d52c7603b4d3b116494d1a8854588e34ff04c))
* Remove unused ai_generation filter from History page ([84d8889](https://github.com/sharkhunterr/smartunarr/-/commit/84d8889783511e25f16e5b9471435ad44522654d))
* Resolve linting and build errors for CI compatibility ([ab19c34](https://github.com/sharkhunterr/smartunarr/-/commit/ab19c3476a8da5aaa38443c55ab7960af58562d4))
* Serialize timing details to frontend and improve display ([7a4b68e](https://github.com/sharkhunterr/smartunarr/-/commit/7a4b68edb294314aa92c403bccd33bbcab47198a))
* Use assigned block name for timing calculation instead of datetime lookup ([f2571ed](https://github.com/sharkhunterr/smartunarr/-/commit/f2571edc41eb658f8360ef1efd2feeab8ecabfd2))

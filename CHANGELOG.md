# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial plugin structure copied from `openclaw-lightrag-local` repository.
- Comprehensive README with use cases, known issues, error handling, and roadmap.
- Basic configuration schema and UI hints.

### Changed
- None yet.

### Fixed
- None yet.

## [0.2.0] - 2026-02-21

### Added
- USAGE.md with advanced configuration, custom hooks, and integration examples.
- Detailed use cases with code examples (USE_CASES.md).
- Comprehensive error reference table (ERRORS.md).
- Roadmap and missing features (TODO.md).
- TypeScript declaration file for OpenClaw plugin SDK (openclaw-plugin-sdk.d.ts).

### Changed
- Improved type safety in hooks (event validation, optional chaining).
- Updated README.md with technical limitations and performance metrics.
- Enhanced configuration schema alignment with OpenClaw standards.
- Package version bumped to 0.2.0.

### Fixed
- TypeScript compilation errors (missing module definitions).
- Insecure type handling in hooks (event.from, event.timestamp).
- Manifest completeness (added name, description, version).

## [0.1.0] - 2026-02-21

### Added
- First release: plugin ready for use with OpenClaw Gateway 2026.1+.
- Supports LightRAG local server v1.x.
- Auto‑ingestion and auto‑recall hooks.
- Configurable capture mode and debug logging.
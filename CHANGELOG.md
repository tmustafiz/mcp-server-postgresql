# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-beta.1] - 2024-03-06

### Added
- Initial beta release with SSL support
- PostgreSQL connection pooling
- Built-in tools for schema inspection and ERD generation
- Support for both HTTP and STDIO transports
- TypeScript support with type definitions
- Environment-based configuration
- SSL connection support for PostgreSQL
- Extensible tool system for custom tools

### Changed
- Updated server implementation to use proper transport handling
- Improved error handling and graceful shutdown

### Fixed
- Module resolution issues with ES modules
- Server connection handling
- Type definitions for tool callbacks 
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Thorium is a scalable file analysis and data generation platform that orchestrates Docker/VM/shell tools at scale. It runs on Kubernetes and provides a RESTful API, web UI, and CLI for file analysis workflows.

## Build Commands

### Rust (Backend)
```bash
# Build all workspace members (requires nightly Rust)
rustup default nightly-2025-08-01
cargo build --release --features vendored-openssl

# Build specific crate
cargo build -p thorium-api
cargo build -p thorctl
cargo build -p thorium-agent

# Run tests
cargo test

# Generate developer documentation
cargo doc --no-deps
```

### Frontend (ui/)
```bash
cd ui
npm install
npm run dev                    # Development server
npm run build                  # Production build
npm run build-preview          # Preview build
npm run lint                   # ESLint
npm run format                 # Prettier formatting
npm run validate-style         # Check formatting without changes
```

### Documentation
```bash
# Build user documentation (mdBook)
cargo install mdbook
mdbook build api/docs
```

## Architecture

### Workspace Crates

- **api/** (`thorium-api`) - Core API server and client library. Uses Axum framework. The `thorium` lib exports both API server functionality and a client SDK. Feature flags control what's included (api, client, k8s, trace, etc.)

- **scaler/** (`thorium-scaler`) - Kubernetes pod autoscaler for analysis jobs

- **agent/** (`thorium-agent`) - Runs on worker nodes to execute analysis tools. Supports Linux cgroups for resource isolation

- **reactor/** (`thorium-reactor`) - Orchestrates agents in non-Kubernetes environments (baremetal/VMs). Optional KVM support

- **operator/** (`thorium-operator`) - Kubernetes operator for deploying/managing Thorium clusters

- **thorctl/** - CLI tool for users to interact with Thorium (upload files, run analyses, manage images/pipelines)

- **thoradm/** - Administrative CLI for Thorium maintenance tasks (database operations, S3, Redis)

- **event-handler/** - Processes system events asynchronously

- **search-streamer/** - Streams search results from Scylla to Elasticsearch

- **cart-rs/** - Library for CART file format (encrypts/compresses files for safe malware storage)

- **thorium-derive/** - Procedural macros for the Thorium codebase

### Frontend (ui/)
React + TypeScript SPA built with Vite. Key directories:
- `src/thorpi/` - API client
- `src/pages/` - Route pages
- `src/components/` - Reusable UI components
- `src/models/` - TypeScript interfaces

### Tools (tools/)
Contains Docker image definitions and pipeline configurations for analysis tools (binwalk, clamav, yara, etc.). Use `thorctl toolbox` to import tools.

### Deployment
- **minithor/** - Single-node deployment using Minikube for development/testing
- **megathor/** - Ansible playbooks for production baremetal/VM deployments

## Key Dependencies

- **ScyllaDB** - Primary database
- **Elasticsearch** - Full-text search
- **Redis** - Caching and job queues
- **S3** - Object storage for files (supports any S3-compatible storage)
- **Kubernetes** - Container orchestration (production deployments)

## Feature Flags

The `api` crate uses extensive feature flags. Common combinations:
- `api` - Include API server dependencies
- `client` - Include async client SDK
- `k8s` - Kubernetes integration
- `trace` - OpenTelemetry tracing
- `test-utilities` - Test helpers
- `vendored-openssl` - Static link OpenSSL (for cross-compilation)

## Cross-Compilation

Binaries are cross-compiled for multiple platforms:
- `x86_64-unknown-linux-musl` (static Linux)
- `x86_64-pc-windows-gnu` (Windows)
- `x86_64-apple-darwin` / `aarch64-apple-darwin` (macOS)

Use `--features vendored-openssl` when cross-compiling.

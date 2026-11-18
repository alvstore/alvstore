#!/usr/bin/env bash
# Wrapper around the Prisma CLI that skips engine downloads (offline-friendly).
# The generated client uses the WASM query compiler + pg driver adapter, so no
# native engines are needed at runtime; generate never invokes schema-engine.
export PRISMA_SCHEMA_ENGINE_BINARY="${PRISMA_SCHEMA_ENGINE_BINARY:-/bin/true}"
export PRISMA_QUERY_ENGINE_BINARY="${PRISMA_QUERY_ENGINE_BINARY:-/bin/true}"
export PRISMA_QUERY_ENGINE_LIBRARY="${PRISMA_QUERY_ENGINE_LIBRARY:-/bin/true}"
export CHECKPOINT_DISABLE=1
exec npx prisma "$@"

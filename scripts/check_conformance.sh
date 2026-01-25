#!/bin/bash

# DTXT Conformance Test Unified Runner
# This script runs the conformance tests for all reference implementations.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

ROOT_DIR=$(pwd)

echo -e "${BLUE}DTXT Conformance Test Suite${NC}"
echo "================================="

# TypeScript
echo -e "\n${BLUE}Running TypeScript conformance tests...${NC}"
cd "$ROOT_DIR/ref-impl/ts"
npx -y tsx run_conformance.ts

# Python
echo -e "\n${BLUE}Running Python conformance tests...${NC}"
cd "$ROOT_DIR/ref-impl/python"
python3 run_conformance.py

# Go
echo -e "\n${BLUE}Running Go conformance tests...${NC}"
cd "$ROOT_DIR/ref-impl/go"
go run cmd/conformance/main.go

# Rust
echo -e "\n${BLUE}Running Rust conformance tests...${NC}"
cd "$ROOT_DIR/ref-impl/rs"
cargo run --quiet --bin run_conformance

echo -e "\n${GREEN}All implementations passed conformance tests successfully!${NC}"

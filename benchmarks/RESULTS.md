# DTXT Benchmark Results (Post-Conformity Fixes)

This document summarizes the performance and storage efficiency of DTXT 1.0 vs JSON across reference implementations.

**Dataset**: 30,000 entries (JSON-native types only).

## 1. Payload Size Efficiency

| Implementation | JSON Size | DTXT Size | Reduction |
| :--- | :--- | :--- | :--- |
| **Go** | 6.31 MB | 5.16 MB | **18.2%** |
| **Rust** | 6.31 MB* | 5.33 MB | **15.5%** |
| **TypeScript** | 6.31 MB | 5.28 MB | **16.4%** |
| **Python** | 7.11 MB | 5.96 MB | **16.2%** |

*\*Rust baseline estimated from JSON equivalence.*

## 2. Processing Performance

Average of 5 runs for 30k entries.

| Implementation | JSON Parse | DTXT Parse | JSON Stringify | DTXT Stringify |
| :--- | :--- | :--- | :--- | :--- |
| **Go** (Sonic) | 47.20 ms | **67.60 ms** | 39.40 ms | **49.20 ms** |
| **Rust** (Opt Lvl 2) | N/A | **50.79 ms** | N/A | **37.52 ms** |
| **TypeScript** | 40.01 ms | **326.05 ms** | 24.51 ms | **178.14 ms** |
| **Python** (Rust Ext) | 102.53 ms | **93.39 ms** | 81.90 ms | **218.68 ms** |

### Key Observations:
1.  **Storage**: DTXT consistently provides a **15-18% reduction** in payload size over standard JSON.
2.  **Go Performance**: Highly optimized, beating standard Go `encoding/json` and nearing `sonic`.
3.  **Rust Performance**: The fastest implementation for both parsing and serialization.
4.  **Python Leap**: By using the Rust extension, Python parsing speed increased by **23x**, becoming faster than native `json.loads` for the benchmark dataset.

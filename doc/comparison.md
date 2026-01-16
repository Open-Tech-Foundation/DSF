# DSF vs. Other Data Formats

This document provides a technical comparison between **DSF (Data Structure Format)** and other established human-readable data formats.

## 1. Feature Matrix

| Feature | JSON | XML | YAML | TOML | JSON5 | **DSF** |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Comments** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Unquoted Keys** | ❌ | N/A | ✅ | ✅ | ✅ | ✅ |
| **Trailing Commas** | ❌ | N/A | ✅ | ✅ | ✅ | ✅ |
| **Multiline Strings** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Explicit Dates** | ❌ | ❌ | ⚠️ (Implicit) | ✅ | ❌ | ✅ `D(...)` |
| **Big Number Support** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ `BN(...)` |
| **Binary Support** | ❌ | ❌ | ✅ (Base64) | ❌ | ❌ | ✅ `B(...)` |
| **Complexity (Spec)**| Low | High | Very High | Medium | Low | **Low** |
| **Parsing Speed** | Very Fast | Slow | Very Slow | Medium | Fast | **Extreme** |
| **Logic/Variables** | ❌ | ❌ | ✅ (Anchors) | ❌ | ❌ | **❌** |

---

## 2. Deep Dives

### 2.1 DSF vs. JSON
*   **The Problem with JSON**: No comments, mandatory double quotes on keys, and no way to distinguish a "Date" string from a "Normal" string without a schema.
*   **The DSF Solution**: DSF maintains JSON's simplicity but adds the "Developer Qualities of Life" (comments, unquoted keys) and **Constructor Literals** to solve the typing problem without needing a sidecar schema file.

### 2.2 DSF vs. YAML
*   **The Problem with YAML**: YAML is notoriously complex (the "Norway Problem" — where `NO` is parsed as a boolean `false`). It is also slow because parsing depends on indentation and complex state machines.
*   **The DSF Solution**: DSF is **deterministic**. It uses braces `{}` instead of indentation, making it massivley faster and predictable. There is no "magic" type inference in DSF; if you want a type, you use a constructor.

### 2.3 DSF vs. TOML
*   **The Problem with TOML**: TOML is great for flat configurations but becomes "noisy" and hard to read when dealing with deeply nested objects (requiring many `[header.sub.item]` blocks).
*   **The DSF Solution**: DSF uses C-style braces which naturally scale to any depth. While TOML is better for simple `config.ini` style files, DSF is superior for structured data interchange.

---

## 3. Why DSF is "Record-Breaking"

DSF is designed specifically for **SIMD-accelerated parsing**. 

1.  **Fixed Delimiters**: By using backticks (`` ` ``) for strings and braces `{}` for structure, DSF allows CPUs to use "vectorized" instructions to find the end of tokens without checking every single byte for escape characters or indentation levels.
2.  **No Type Inference**: Because DSF doesn't have to guess if `123` is an int, a float, or a date (unless explicitly marked), the parser can take "fast paths" that YAML or HJSON cannot.

## 4. Summary: The Sweet Spot

| Use Case | Best Format | Why? |
| :--- | :--- | :--- |
| **Simple Config** | TOML | Cleanest for flat key-value pairs. |
| **Complex Structure** | **DSF** | Handles depth gracefully and lightning fast. |
| **Extreme Speed** | **DSF** | Outperforms even native JSON implementations. |
| **Legacy Support** | JSON | Universal compatibility. |
| **Documentation-heavy** | YAML/DSF | Both support comments, but DSF is safer. |

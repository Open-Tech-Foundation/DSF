# DSF 1.0 — Data Structure Format (Experimental Draft)

**By the [Open Tech Foundation](https://github.com/Open-Tech-Foundation)**

> [!WARNING]
> This specification is in an **experimental draft** state and is subject to change. It is currently being shared for feedback and initial implementation testing.

---

## 1. Overview

**DSF (Data Structure Format)** is a human-readable, structured data format designed for configuration and data interchange.

A DSF document represents a **single object**, explicitly delimited by `{}`.
DSF emphasizes:

* strict and predictable syntax
* fast parsing
* minimal token noise
* explicit typing via constructor literals
* human readability without implicit semantics

DSF is **not executable**, has **no evaluation semantics**, and is **not a programming language**.

---

## 2. Character Encoding

* DSF documents **MUST** be encoded in **UTF-8**.
* Parsers **MUST** reject invalid UTF-8 input.

---

## 3. Whitespace

* Whitespace characters:

  * space (`U+0020`)
  * horizontal tab (`U+0009`)
  * line feed (`\n`)
  * carriage return + line feed (`\r\n`)
* Whitespace may appear between tokens and has **no semantic meaning**.

Canonical output **SHOULD** normalize line endings to `\n`.

---

## 4. Comments

* DSF supports **single-line comments** only.
* A comment begins with `//` and continues until the end of the line.

```dsf
// This is a comment
key: 123, // trailing comment
```

---

## 5. Document Structure (Root Object)

A DSF document **MUST** consist of a single object enclosed in `{}`.

```dsf
{
  name: `example`,
  count: 10,
}
```

* Root arrays or scalar roots are **not allowed**.
* The root object follows the same rules as any nested object.

---

## 6. Keys (Identifiers)

### 6.1 Key Syntax

* Keys are **unquoted identifiers**
* Allowed characters:

  * ASCII letters `A–Z a–z`
  * digits `0–9`
  * underscore `_`
* No spaces allowed
* Leading digits **ARE allowed**

```dsf
{
  a: 1,
  user_id: 2,
  123key: 3,
}
```

---

### 6.2 Disallowed in Keys

* Dot (`.`)
* Whitespace
* Unicode characters
* Quoted keys

```dsf
{
  user.name: 1,   // ❌ invalid
  "user": 2,      // ❌ invalid
}
```

#### Rationale

Dots are commonly interpreted as hierarchical path separators in other systems.
DSF enforces **explicit structure only**, avoiding implied nesting.

---

### 6.3 Keywords and Keys

`T`, `F`, and `N` are **value literals** when used in value position.

They have **no special meaning when used as keys**.

```dsf
{
  T: 1,
  F: 2,
  N: 3,
}
```

---

## 7. Values

A value may be one of the following:

* Number
* Boolean (`T`, `F`)
* Null (`N`)
* String
* Array
* Object
* Constructor literal

---

## 8. Numbers

### 8.1 Number Grammar

DSF numbers follow **JSON number grammar**.

Supported:

```dsf
0
123
-42
3.14
1e9
-2.5E-3
```

Not supported:

* Leading `+`
* Leading zeroes (`01`)
* Hex, binary, octal
* `NaN`, `Infinity`
* Digit separators (`_`)

---

### 8.2 Numeric Semantics

* Precision is implementation-defined.
* DSF does not guarantee arbitrary precision for normal numbers.
* Use `BN(...)` for exact large integers.

---

## 9. Strings

Strings are enclosed in backticks (`` ` ``).

```dsf
{
  name: `Sample`,
  message: `Hello "World"`,
}
```

* Backticks within a string are not supported in 1.0 (requires 1.1 or escaping).
* Normal whitespace and newlines are allowed within strings.

---

## 10. Boolean and Null Literals

| Literal | Meaning |
| ------- | ------- |
| `T`     | true    |
| `F`     | false   |
| `N`     | null    |

* Literals are **case-sensitive**.

---

## 11. Arrays

Arrays use square brackets `[]`.

```dsf
{
  values: [1, 2, 3],
}
```

* Elements are comma-separated
* Trailing commas are allowed

---

## 12. Objects

Objects use curly braces `{}`.

```dsf
{
  config: {
    enabled: T,
    retries: 3,
  },
}
```

* Duplicate keys within the same object are **errors**
* Trailing commas are allowed

---

## 13. Constructor Literals

Constructor literals provide **explicit typed values**.

### General Syntax

```
TypeName(payload)
```

Rules:

* No whitespace between `TypeName` and `(`
* Payload:

  * MUST be non-empty
  * MUST NOT contain whitespace
  * MUST NOT contain `(` or `)`
* No nesting of constructors
* Constructors are declarative, not executable

---

## 14. Standard Constructor Literals

### 14.1 Date / DateTime — `D(...)`

```dsf
D(2026-01-15)
D(2026-01-15T10:30:00Z)
```

* Payload is an ISO-8601 date or datetime token
* DSF does not distinguish date-only vs datetime syntactically
* DSF does not validate ISO correctness

---

### 14.2 Big Number — `BN(...)`

```dsf
BN(9007199254740993)
```

Rules:

* Payload MUST match: `^-?[0-9]+$`
* Represents an exact arbitrary-precision integer

Canonicalization:

* Remove leading zeros
* `BN(-0)` → `BN(0)`

---

### 14.3 Binary — `B(...)`

```dsf
B(89504E470D0A1A0A)
```

Rules:

* Payload MUST be hexadecimal digits
* Case-insensitive input
* Canonical output MUST use uppercase hex

Represents arbitrary binary data.

---

## 15. Trailing Commas

Trailing commas are **allowed** in:

* Objects
* Arrays

```dsf
{
  a: 1,
  b: 2,
}
```

---

## 16. Canonical Form (Recommended)

Canonical DSF output SHOULD:

* Use uppercase literals (`T`, `F`, `N`)
* Use uppercase constructor names
* Normalize line endings to `\n`
* Normalize `BN(...)` and `B(...)` payloads
* Avoid unnecessary whitespace

---

## 17. JSON Interoperability (Recommended)

| DSF       | JSON         |
| --------- | ------------ |
| Number    | number       |
| `T` / `F` | true / false |
| `N`       | null         |
| `D(...)`  | string       |
| `BN(...)` | string       |
| `B(...)`  | string       |

Typed JSON wrappers MAY be used by tooling.

---

## 18. Error Handling

Parsers MUST report errors for:

* Invalid tokens
* Invalid keys
* Duplicate keys
* Invalid constructor payloads
* Unterminated structures
* Trailing invalid content

---

## 19. Security Considerations

* DSF has no execution semantics.
* Parsers SHOULD enforce limits on:

  * nesting depth
  * constructor payload length
* Binary and big-number payloads may be attacker-controlled.

---

## 20. Example

```dsf
// DSF example
{
  name: `Sample`,
  created: D(2026-01-15),
  updated: D(2026-01-15T10:30:00Z),
  active: T,
  count: 42,
  big: BN(9007199254740993),
  hash: B(A7B2319E44CE12BA),
  items: [1, 2, 3],
  meta: {
    retries: 3,
    enabled: F,
  },
}
```

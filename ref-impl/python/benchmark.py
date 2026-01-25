import dtxt
try:
    import dtxt_rs
except ImportError:
    dtxt_rs = None
import json
import time
import random
import os

def generate_large_data(count):
    data = {
        "title": "DTXT vs JSON (JSON-native types only)",
        "description": "Benchmark for base format overhead (unquoted keys, short literals)",
        "entries": []
    }

    for i in range(count):
        data["entries"].append({
            "id": i,
            "uid": f"user-{i}",
            "isActive": i % 2 == 0,
            "score": random.random() * 1000,
            "tags": ["data", "benchmark", "storage", "json", "dtxt"],
            "meta": {
                "level": i % 10,
                "verified": i % 3 == 0,
                "note": None,
                "nested": {
                    "a": 1,
                    "b": False,
                    "c": "nested string"
                }
            }
        })
    return data

DATASET_SIZE = 30000

def run_benchmark():
    print(f"Generating dataset with {DATASET_SIZE} entries (JSON-native types only)...")
    raw_data = generate_large_data(DATASET_SIZE)

    # 1. Payload Size Comparison
    json_str = json.dumps(raw_data)
    dtxt_str = dtxt.dumps(raw_data)

    base_path = "../../benchmarks/python"
    json_path = os.path.join(base_path, "bench_v2.json")
    dtxt_path = os.path.join(base_path, "bench_v2.dtxt")

    with open(json_path, "w") as f:
        f.write(json_str)
    with open(dtxt_path, "w") as f:
        f.write(dtxt_str)

    json_size = os.path.getsize(json_path)
    dtxt_size = os.path.getsize(dtxt_path)

    print("\n--- Payload Size ---")
    print(f"JSON: {json_size / 1024 / 1024:.2f} MB")
    print(f"DTXT:  {dtxt_size / 1024 / 1024:.2f} MB")
    print(f"Reduction: {(1 - dtxt_size / json_size) * 100:.1f}%")

    # 2. Performance Comparison (Time)
    iterations = 5

    print("\n--- Parsing Performance (Average of 5 runs) ---")

    json_parse_total = 0
    for _ in range(iterations):
        start = time.perf_counter()
        json.loads(json_str)
        json_parse_total += (time.perf_counter() - start) * 1000
    print(f"json.loads:     {json_parse_total / iterations:.2f} ms")

    # Force pure Python for comparison
    original_rs = dtxt.dtxt_rs
    dtxt.dtxt_rs = None
    pure_python_parse_total = 0
    for _ in range(iterations):
        start = time.perf_counter()
        dtxt.loads(dtxt_str)
        pure_python_parse_total += (time.perf_counter() - start) * 1000
    print(f"dtxt.loads (Pure Python): {pure_python_parse_total / iterations:.2f} ms")
    dtxt.dtxt_rs = original_rs

    if dtxt.dtxt_rs:
        rust_ext_parse_total = 0
        for _ in range(iterations):
            start = time.perf_counter()
            dtxt.loads(dtxt_str)
            rust_ext_parse_total += (time.perf_counter() - start) * 1000
        print(f"dtxt.loads (Rust Ext):    {rust_ext_parse_total / iterations:.2f} ms")
        print(f"Speedup: {pure_python_parse_total / rust_ext_parse_total:.1f}x")

    print("\n--- Serialization Performance (Average of 5 runs) ---")

    json_stringify_total = 0
    for _ in range(iterations):
        start = time.perf_counter()
        json.dumps(raw_data)
        json_stringify_total += (time.perf_counter() - start) * 1000
    print(f"json.dumps:  {json_stringify_total / iterations:.2f} ms")

    dtxt_stringify_total = 0
    for _ in range(iterations):
        start = time.perf_counter()
        dtxt.dumps(raw_data)
        dtxt_stringify_total += (time.perf_counter() - start) * 1000
    print(f"dtxt.dumps:   {dtxt_stringify_total / iterations:.2f} ms")

if __name__ == "__main__":
    run_benchmark()

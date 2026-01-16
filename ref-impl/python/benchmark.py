import dsf
try:
    import dsf_rs
except ImportError:
    dsf_rs = None
import json
import time
import random
import os

def generate_large_data(count):
    data = {
        "title": "DSF vs JSON (JSON-native types only)",
        "description": "Benchmark for base format overhead (unquoted keys, short literals)",
        "entries": []
    }

    for i in range(count):
        data["entries"].append({
            "id": i,
            "uid": f"user-{i}",
            "isActive": i % 2 == 0,
            "score": random.random() * 1000,
            "tags": ["data", "benchmark", "storage", "json", "dsf"],
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
    dsf_str = dsf.dumps(raw_data)

    base_path = "../../benchmarks/python"
    json_path = os.path.join(base_path, "bench_v2.json")
    dsf_path = os.path.join(base_path, "bench_v2.dsf")

    with open(json_path, "w") as f:
        f.write(json_str)
    with open(dsf_path, "w") as f:
        f.write(dsf_str)

    json_size = os.path.getsize(json_path)
    dsf_size = os.path.getsize(dsf_path)

    print("\n--- Payload Size ---")
    print(f"JSON: {json_size / 1024 / 1024:.2f} MB")
    print(f"DSF:  {dsf_size / 1024 / 1024:.2f} MB")
    print(f"Reduction: {(1 - dsf_size / json_size) * 100:.1f}%")

    # 2. Performance Comparison (Time)
    iterations = 5

    print("\n--- Parsing Performance (Average of 5 runs) ---")

    json_parse_total = 0
    for _ in range(iterations):
        start = time.perf_counter()
        json.loads(json_str)
        json_parse_total += (time.perf_counter() - start) * 1000
    print(f"json.loads:  {json_parse_total / iterations:.2f} ms")

    dsf_parse_total = 0
    for _ in range(iterations):
        start = time.perf_counter()
        dsf.loads(dsf_str)
        dsf_parse_total += (time.perf_counter() - start) * 1000
    print(f"dsf.loads:   {dsf_parse_total / iterations:.2f} ms")

    if dsf_rs:
        dsf_rs_parse_total = 0
        for _ in range(iterations):
            start = time.perf_counter()
            dsf_rs.loads(dsf_str)
            dsf_rs_parse_total += (time.perf_counter() - start) * 1000
        print(f"dsf_rs.loads: {dsf_rs_parse_total / iterations:.2f} ms")

    print("\n--- Serialization Performance (Average of 5 runs) ---")

    json_stringify_total = 0
    for _ in range(iterations):
        start = time.perf_counter()
        json.dumps(raw_data)
        json_stringify_total += (time.perf_counter() - start) * 1000
    print(f"json.dumps:  {json_stringify_total / iterations:.2f} ms")

    dsf_stringify_total = 0
    for _ in range(iterations):
        start = time.perf_counter()
        dsf.dumps(raw_data)
        dsf_stringify_total += (time.perf_counter() - start) * 1000
    print(f"dsf.dumps:   {dsf_stringify_total / iterations:.2f} ms")

if __name__ == "__main__":
    run_benchmark()

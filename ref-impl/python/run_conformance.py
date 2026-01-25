import sys
import os
import json
from datetime import datetime, date
import binascii
import dtxt

# Get the path to the tests
TESTS_PATH = os.path.join(os.path.dirname(__file__), '../../tests/conformance/tests.json')

with open(TESTS_PATH, 'r', encoding='utf-8') as f:
    tests = json.load(f)

def normalize(obj):
    if isinstance(obj, date):
        return f"$date:{obj.isoformat()}"
    if isinstance(obj, datetime):
        return f"$date:{obj.date().isoformat()}"
    if isinstance(obj, bytes):
        return f"$binary:{obj.hex().upper()}"
    if isinstance(obj, int) and (obj > 2**53 - 1 or obj < -(2**53 - 1)):
        # In Python ints are arbitrary precision, so we just treat them all as potential bigints 
        # but the JSON expected format uses $bigint for BN constructors.
        # Wait, the parser returns int for BN. 
        # We need to know if it came from BN or not? 
        # Actually our dtxt.py doesn't distinguish between int from Number and int from BN.
        # But for conformance, we can just check if it matches the expected string.
        pass
    
    if isinstance(obj, list):
        return [normalize(x) for x in obj]
    if isinstance(obj, dict):
        return {k: normalize(v) for k, v in obj.items()}
    
    # special handling for bigint string representation in expected
    return obj

def run_tests():
    passed = 0
    failed = 0
    
    print(f"Running {len(tests)} conformance tests...")
    
    for test in tests:
        try:
            parsed = dtxt.loads(test['input'])
            
            if 'error' in test:
                print(f"FAIL: {test['name']} - Expected error {test['error']}, but it parsed successfully. Result: {parsed}")
                failed += 1
                continue
            
            # Need to handle the $bigint and $binary normalization
            # The expected values for BN are "$bigint:..." and for B are "$binary:..."
            # Dates are "$date:..."
            
            def deep_normalize(obj):
                if isinstance(obj, (datetime, date)):
                    return f"$date:{obj.strftime('%Y-%m-%d')}"
                if isinstance(obj, bytes):
                    return f"$binary:{obj.hex().upper()}"
                
                if isinstance(obj, list):
                    return [deep_normalize(x) for x in obj]
                if isinstance(obj, dict):
                    return {k: deep_normalize(v) for k, v in obj.items()}
                
                return obj

            normalized = deep_normalize(parsed)
            
            # Special case for BN in Python: they are just ints.
            # We need to check if the expected value is a string starting with "$bigint:"
            def compare(actual, expected):
                if isinstance(expected, str) and expected.startswith("$bigint:"):
                    return str(actual) == expected.split(":")[1]
                if isinstance(actual, list) and isinstance(expected, list):
                    if len(actual) != len(expected): return False
                    return all(compare(a, e) for a, e in zip(actual, expected))
                if isinstance(actual, dict) and isinstance(expected, dict):
                    if len(actual) != len(expected): return False
                    return all(k in expected and compare(actual[k], expected[k]) for k in actual)
                return actual == expected

            if compare(normalized, test['expected']):
                print(f"PASS: {test['name']}")
                passed += 1
            else:
                print(f"FAIL: {test['name']} - Result mismatch.")
                print(f"  Expected: {test['expected']}")
                print(f"  Got:      {normalized}")
                failed += 1
                
        except Exception as e:
            if 'error' in test:
                print(f"PASS: {test['name']} (Caught expected error: {e})")
                passed += 1
            else:
                print(f"FAIL: {test['name']} - Unexpected error: {e}")
                failed += 1
                
    print(f"\nConformance Test Results: {passed} passed, {failed} failed.")
    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    run_tests()

package main

import (
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"reflect"
	"strings"
	"time"

	"github.com/Open-Tech-Foundation/dtxt/ref-impl/go/dtxt"
)

type TestItem struct {
	Name     string      `json:"name"`
	Input    string      `json:"input"`
	Expected interface{} `json:"expected"`
	Error    string      `json:"error"`
}

func normalize(obj interface{}) interface{} {
	if t, ok := obj.(time.Time); ok {
		return fmt.Sprintf("$date:%s", t.Format("2006-01-02"))
	}
	if b, ok := obj.([]byte); ok {
		return fmt.Sprintf("$binary:%X", b)
	}
	if bi, ok := obj.(*big.Int); ok {
		return fmt.Sprintf("$bigint:%s", bi.String())
	}
	if m, ok := obj.(map[string]dtxt.DTXTValue); ok {
		res := make(map[string]interface{})
		for k, v := range m {
			res[k] = normalize(v)
		}
		return res
	}
	if a, ok := obj.([]dtxt.DTXTValue); ok {
		res := make([]interface{}, len(a))
		for i, v := range a {
			res[i] = normalize(v)
		}
		return res
	}
	return obj
}

func compare(actual, expected interface{}) bool {
	// Special handling for the $bigint, $binary, $date strings in expected
	if expStr, ok := expected.(string); ok {
		if strings.HasPrefix(expStr, "$bigint:") {
			if actStr, ok := actual.(string); ok {
				return actStr == expStr
			}
			// If actual is float64 (from json.Unmarshal of expected), wait...
			// The normalize function converts *big.Int to "$bigint:..." string.
			// So actual SHOULD be a string here if it's a normalized bigint.
		}
	}

	return reflect.DeepEqual(actual, expected)
}

func main() {
	// Assume we are in ref-impl/go
	testsPath := "../../tests/conformance/tests.json"

	data, err := os.ReadFile(testsPath)
	if err != nil {
		fmt.Printf("Error reading tests: %v\n", err)
		os.Exit(1)
	}

	var tests []TestItem
	if err := json.Unmarshal(data, &tests); err != nil {
		fmt.Printf("Error unmarshaling tests: %v\n", err)
		os.Exit(1)
	}

	passed := 0
	failed := 0

	fmt.Printf("Running %d conformance tests...\n", len(tests))

	for _, test := range tests {
		parsed, err := dtxt.Parse(test.Input)

		if test.Error != "" {
			if err == nil {
				fmt.Printf("FAIL: %s - Expected error %s, but it parsed successfully. Result: %v\n", test.Name, test.Error, parsed)
				failed++
			} else {
				fmt.Printf("PASS: %s (Caught expected error: %v)\n", test.Name, err)
				passed++
			}
			continue
		}

		if err != nil {
			fmt.Printf("FAIL: %s - Unexpected error: %v\n", test.Name, err)
			failed++
			continue
		}

		normalized := normalize(parsed)

		if reflect.DeepEqual(normalized, test.Expected) {
			fmt.Printf("PASS: %s\n", test.Name)
			passed++
		} else {
			fmt.Printf("FAIL: %s - Result mismatch.\n", test.Name)
			fmt.Printf("  Expected: %v\n", test.Expected)
			fmt.Printf("  Got:      %v\n", normalized)
			failed++
		}
	}

	fmt.Printf("\nConformance Test Results: %d passed, %d failed.\n", passed, failed)
	if failed > 0 {
		os.Exit(1)
	}
}

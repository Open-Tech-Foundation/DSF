package main

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"time"

	"github.com/Open-Tech-Foundation/dtxt/ref-impl/go/dtxt"
	"github.com/bytedance/sonic"
)

func generateLargeData(count int) map[string]dtxt.DTXTValue {
	entries := make([]dtxt.DTXTValue, 0, count)
	for i := 0; i < count; i++ {
		meta := map[string]dtxt.DTXTValue{
			"level":    float64(i % 10),
			"verified": i%3 == 0,
			"note":     nil,
			"nested": map[string]dtxt.DTXTValue{
				"a": 1.0,
				"b": false,
				"c": "nested string",
			},
		}

		entry := map[string]dtxt.DTXTValue{
			"id":       float64(i),
			"uid":      fmt.Sprintf("user-%d", i),
			"isActive": i%2 == 0,
			"score":    rand.Float64() * 1000,
			"tags":     []dtxt.DTXTValue{"data", "benchmark", "storage", "json", "dtxt"},
			"meta":     meta,
		}
		entries = append(entries, entry)
	}

	return map[string]dtxt.DTXTValue{
		"title":       "DTXT vs JSON (Go)",
		"description": "Benchmark for base format overhead",
		"entries":     entries,
	}
}

const datasetSize = 30000

func main() {
	fmt.Printf("Generating dataset with %d entries...\n", datasetSize)
	rawData := generateLargeData(datasetSize)

	// Payload Size Comparison
	jsonBytes, _ := json.Marshal(rawData)
	dtxtStr := dtxt.Stringify(rawData, "")

	os.WriteFile("../../benchmarks/go/bench_v2_go.json", jsonBytes, 0644)
	os.WriteFile("../../benchmarks/go/bench_v2_go.dtxt", []byte(dtxtStr), 0644)

	jsonSize := len(jsonBytes)
	dtxtSize := len(dtxtStr)

	fmt.Println("\n--- Payload Size ---")
	fmt.Printf("JSON: %.2f MB\n", float64(jsonSize)/1024/1024)
	fmt.Printf("DTXT:  %.2f MB\n", float64(dtxtSize)/1024/1024)
	fmt.Printf("Reduction: %.1f%%\n", (1.0-float64(dtxtSize)/float64(jsonSize))*100)

	// Performance Comparison
	iterations := 5

	fmt.Printf("\n--- Parsing Performance (Average of %d runs) ---\n", iterations)

	var jsonParseTotal time.Duration
	for i := 0; i < iterations; i++ {
		start := time.Now()
		var target interface{}
		json.Unmarshal(jsonBytes, &target)
		jsonParseTotal += time.Since(start)
	}
	fmt.Printf("json.Unmarshal:  %.2f ms\n", float64(jsonParseTotal.Milliseconds())/float64(iterations))

	var sonicParseTotal time.Duration
	for i := 0; i < iterations; i++ {
		start := time.Now()
		var target interface{}
		sonic.Unmarshal(jsonBytes, &target)
		sonicParseTotal += time.Since(start)
	}
	fmt.Printf("sonic.Unmarshal: %.2f ms\n", float64(sonicParseTotal.Milliseconds())/float64(iterations))

	var dtxtParseTotal time.Duration
	for i := 0; i < iterations; i++ {
		start := time.Now()
		dtxt.Parse(dtxtStr)
		dtxtParseTotal += time.Since(start)
	}
	fmt.Printf("dtxt.Parse:     %.2f ms\n", float64(dtxtParseTotal.Milliseconds())/float64(iterations))

	fmt.Printf("\n--- Serialization Performance (Average of %d runs) ---\n", iterations)

	var jsonStringifyTotal time.Duration
	for i := 0; i < iterations; i++ {
		start := time.Now()
		json.Marshal(rawData)
		jsonStringifyTotal += time.Since(start)
	}
	fmt.Printf("json.Marshal:    %.2f ms\n", float64(jsonStringifyTotal.Milliseconds())/float64(iterations))

	var sonicStringifyTotal time.Duration
	for i := 0; i < iterations; i++ {
		start := time.Now()
		sonic.Marshal(rawData)
		sonicStringifyTotal += time.Since(start)
	}
	fmt.Printf("sonic.Marshal:   %.2f ms\n", float64(sonicStringifyTotal.Milliseconds())/float64(iterations))

	var dtxtStringifyTotal time.Duration
	for i := 0; i < iterations; i++ {
		start := time.Now()
		dtxt.Stringify(rawData, "")
		dtxtStringifyTotal += time.Since(start)
	}
	fmt.Printf("dtxt.Stringify: %.2f ms\n", float64(dtxtStringifyTotal.Milliseconds())/float64(iterations))
}

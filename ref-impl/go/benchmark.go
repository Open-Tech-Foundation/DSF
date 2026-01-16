package main

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"time"

	"github.com/Open-Tech-Foundation/dsf/ref-impl/go/dsf"
)

func generateLargeData(count int) map[string]dsf.DSFValue {
	entries := make([]dsf.DSFValue, 0, count)
	for i := 0; i < count; i++ {
		meta := map[string]dsf.DSFValue{
			"level":    float64(i % 10),
			"verified": i%3 == 0,
			"note":     nil,
			"nested": map[string]dsf.DSFValue{
				"a": 1.0,
				"b": false,
				"c": "nested string",
			},
		}

		entry := map[string]dsf.DSFValue{
			"id":       float64(i),
			"uid":      fmt.Sprintf("user-%d", i),
			"isActive": i%2 == 0,
			"score":    rand.Float64() * 1000,
			"tags":     []dsf.DSFValue{"data", "benchmark", "storage", "json", "dsf"},
			"meta":     meta,
		}
		entries = append(entries, entry)
	}

	return map[string]dsf.DSFValue{
		"title":       "DSF vs JSON (Go)",
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
	dsfStr := dsf.Stringify(rawData, "")

	os.WriteFile("../../benchmarks/go/bench_v2_go.json", jsonBytes, 0644)
	os.WriteFile("../../benchmarks/go/bench_v2_go.dsf", []byte(dsfStr), 0644)

	jsonSize := len(jsonBytes)
	dsfSize := len(dsfStr)

	fmt.Println("\n--- Payload Size ---")
	fmt.Printf("JSON: %.2f MB\n", float64(jsonSize)/1024/1024)
	fmt.Printf("DSF:  %.2f MB\n", float64(dsfSize)/1024/1024)
	fmt.Printf("Reduction: %.1f%%\n", (1.0-float64(dsfSize)/float64(jsonSize))*100)

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
	fmt.Printf("json.Unmarshal: %.2f ms\n", float64(jsonParseTotal.Milliseconds())/float64(iterations))

	var dsfParseTotal time.Duration
	for i := 0; i < iterations; i++ {
		start := time.Now()
		dsf.Parse(dsfStr)
		dsfParseTotal += time.Since(start)
	}
	fmt.Printf("dsf.Parse:     %.2f ms\n", float64(dsfParseTotal.Milliseconds())/float64(iterations))

	fmt.Printf("\n--- Serialization Performance (Average of %d runs) ---\n", iterations)

	var jsonStringifyTotal time.Duration
	for i := 0; i < iterations; i++ {
		start := time.Now()
		json.Marshal(rawData)
		jsonStringifyTotal += time.Since(start)
	}
	fmt.Printf("json.Marshal:   %.2f ms\n", float64(jsonStringifyTotal.Milliseconds())/float64(iterations))

	var dsfStringifyTotal time.Duration
	for i := 0; i < iterations; i++ {
		start := time.Now()
		dsf.Stringify(rawData, "")
		dsfStringifyTotal += time.Since(start)
	}
	fmt.Printf("dsf.Stringify: %.2f ms\n", float64(dsfStringifyTotal.Milliseconds())/float64(iterations))
}

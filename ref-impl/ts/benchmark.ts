import * as dsf from './dsf';
import { writeFileSync, statSync } from 'fs';

function generateLargeData(count: number) {
    const data: any = {
        title: "DSF vs JSON (JSON-native types only)",
        description: "Benchmark for base format overhead (unquoted keys, short literals)",
        entries: []
    };

    for (let i = 0; i < count; i++) {
        data.entries.push({
            id: i,
            uid: `user-${i}`,
            isActive: i % 2 === 0,
            score: Math.random() * 1000,
            tags: ["data", "benchmark", "storage", "json", "dsf"],
            meta: {
                level: i % 10,
                verified: i % 3 === 0,
                note: null,
                nested: {
                    a: 1,
                    b: false,
                    c: "nested string"
                }
            }
        });
    }
    return data;
}

const DATASET_SIZE = 30000; // Increased to ensure good volume

async function runBenchmark() {
    console.log(`Generating dataset with ${DATASET_SIZE} entries (JSON-native types only)...`);
    const rawData = generateLargeData(DATASET_SIZE);

    // 1. Payload Size Comparison
    const jsonStr = JSON.stringify(rawData);
    const dsfStr = dsf.stringify(rawData);

    writeFileSync('bench_v2.json', jsonStr);
    writeFileSync('bench_v2.dsf', dsfStr);

    const jsonSize = statSync('bench_v2.json').size;
    const dsfSize = statSync('bench_v2.dsf').size;

    console.log("\n--- Payload Size ---");
    console.log(`JSON: ${(jsonSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`DSF:  ${(dsfSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Reduction: ${((1 - dsfSize / jsonSize) * 100).toFixed(1)}%`);

    // 2. Performance Comparison (Time)
    const iterations = 5;

    console.log("\n--- Parsing Performance (Average of 5 runs) ---");

    let jsonParseTotal = 0;
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        JSON.parse(jsonStr);
        jsonParseTotal += performance.now() - start;
    }
    console.log(`JSON.parse: ${(jsonParseTotal / iterations).toFixed(2)} ms`);

    let dsfParseTotal = 0;
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        dsf.parse(dsfStr);
        dsfParseTotal += performance.now() - start;
    }
    console.log(`dsf.parse:  ${(dsfParseTotal / iterations).toFixed(2)} ms`);

    console.log("\n--- Serialization Performance (Average of 5 runs) ---");

    let jsonStringifyTotal = 0;
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        JSON.stringify(rawData);
        jsonStringifyTotal += performance.now() - start;
    }
    console.log(`JSON.stringify: ${(jsonStringifyTotal / iterations).toFixed(2)} ms`);

    let dsfStringifyTotal = 0;
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        dsf.stringify(rawData);
        dsfStringifyTotal += performance.now() - start;
    }
    console.log(`dsf.stringify:  ${(dsfStringifyTotal / iterations).toFixed(2)} ms`);

    // 3. Memory
    console.log("\n--- Memory Usage (Current Process) ---");
    const mem = process.memoryUsage();
    console.log(`RSS:  ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
}

runBenchmark().catch(console.error);

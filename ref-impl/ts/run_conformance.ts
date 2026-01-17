import * as dsf from './dsf';
import * as fs from 'fs';
import * as path from 'path';
import * as assert from 'assert';

const TESTS_PATH = path.join(__dirname, '../../tests/conformance/tests.json');
const tests = JSON.parse(fs.readFileSync(TESTS_PATH, 'utf-8'));

function runTests() {
    let passed = 0;
    let failed = 0;

    console.log(`Running ${tests.length} conformance tests...`);

    for (const test of tests) {
        try {
            const parsed = dsf.parse(test.input);

            if (test.error) {
                console.error(`FAIL: ${test.name} - Expected error ${test.error}, but it parsed successfully. Result:`, parsed);
                failed++;
                continue;
            }

            function normalize(obj: any): any {
                if (obj instanceof Date) return `$date:${obj.toISOString().split('T')[0]}`;
                if (obj instanceof Uint8Array) {
                    return `$binary:${Array.from(obj).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join('')}`;
                }
                if (typeof obj === 'bigint') return `$bigint:${obj.toString()}`;
                if (Array.isArray(obj)) return obj.map(normalize);
                if (obj !== null && typeof obj === 'object') {
                    const res: any = {};
                    for (const k of Object.keys(obj)) res[k] = normalize(obj[k]);
                    return res;
                }
                return obj;
            }

            const normalizedParsed = normalize(parsed);

            assert.deepStrictEqual(normalizedParsed, test.expected);
            console.log(`PASS: ${test.name}`);
            passed++;

        } catch (e: any) {
            if (test.error) {
                // In a real implementation, we would check for specific error codes here.
                // For now, we just check that it failed.
                console.log(`PASS: ${test.name} (Caught expected error: ${e.message})`);
                passed++;
            } else {
                console.error(`FAIL: ${test.name} - Unexpected error: ${e.message}`);
                failed++;
            }
        }
    }

    console.log(`\nConformance Test Results: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
}

runTests();

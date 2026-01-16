use dsf::{DSFValue, parse, stringify};
use std::time::Instant;
use rustc_hash::FxHashMap;
use std::fs::File;
use std::io::Write;

// For benchmarking, we need to own the strings that DSFValue borrows from.
struct DataStore {
    strings: Vec<String>,
}

impl DataStore {
    fn new() -> Self {
        Self { strings: Vec::with_capacity(DATASET_SIZE * 10) }
    }
    fn add(&mut self, s: String) -> &str {
        self.strings.push(s);
        self.strings.last().unwrap()
    }
}

fn generate_large_data<'a>(
    count: usize, 
    uids: &'a [String], 
    tags: &'a [DSFValue<'a>]
) -> FxHashMap<&'a str, DSFValue<'a>> {
    let mut entries = Vec::with_capacity(count);
    for i in 0..count {
        let mut meta = FxHashMap::default();
        meta.insert("level", DSFValue::Number((i % 10) as f64));
        meta.insert("verified", DSFValue::Bool(i % 3 == 0));
        meta.insert("note", DSFValue::Null);

        let mut nested = FxHashMap::default();
        nested.insert("a", DSFValue::Number(1.0));
        nested.insert("b", DSFValue::Bool(false));
        nested.insert("c", DSFValue::String("nested string"));
        meta.insert("nested", DSFValue::Object(nested));

        let mut entry = FxHashMap::default();
        entry.insert("id", DSFValue::Number(i as f64));
        entry.insert("uid", DSFValue::String(&uids[i]));
        entry.insert("isActive", DSFValue::Bool(i % 2 == 0));
        entry.insert("score", DSFValue::Number(rand::random::<f64>() * 1000.0));
        entry.insert("tags", DSFValue::Array(tags.to_vec()));
        entry.insert("meta", DSFValue::Object(meta));
        entries.push(DSFValue::Object(entry));
    }

    let mut root = FxHashMap::default();
    root.insert("title", DSFValue::String("DSF vs JSON (Rust)"));
    root.insert("description", DSFValue::String("Benchmark for base format overhead"));
    root.insert("entries", DSFValue::Array(entries));

    root
}

const DATASET_SIZE: usize = 30000;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Generating dataset with {} entries...", DATASET_SIZE);
    
    // Pre-generate strings to satisfy lifetimes
    let uids: Vec<String> = (0..DATASET_SIZE).map(|i| format!("user-{}", i)).collect();
    let tag_strs = vec!["data", "benchmark", "storage", "json", "dsf"];
    let tags: Vec<DSFValue> = tag_strs.iter().map(|&s| DSFValue::String(s)).collect();

    let raw_data = generate_large_data(DATASET_SIZE, &uids, &tags);
    let root_value = DSFValue::Object(raw_data);
    
    let dsf_str = stringify(&root_value, None);
    let dsf_size = dsf_str.len();

    println!("\n--- Payload Size ---");
    println!("DSF:  {:.2} MB", dsf_size as f64 / 1024.0 / 1024.0);

    let iterations = 5;

    println!("\n--- Parsing Performance (Average of {} runs) ---", iterations);

    let mut dsf_parse_total = 0.0;
    for _ in 0..iterations {
        let start = Instant::now();
        let _ = parse(&dsf_str)?;
        dsf_parse_total += start.elapsed().as_secs_f64() * 1000.0;
    }
    println!("dsf-rs:     {:.2} ms", dsf_parse_total / iterations as f64);

    println!("\n--- Serialization Performance (Average of {} runs) ---", iterations);

    let mut dsf_stringify_total = 0.0;
    for _ in 0..iterations {
        let start = Instant::now();
        let _ = stringify(&root_value, None);
        dsf_stringify_total += start.elapsed().as_secs_f64() * 1000.0;
    }
    println!("dsf-rs:     {:.2} ms", dsf_stringify_total / iterations as f64);

    let mut f_dsf = File::create("../../benchmarks/rs/bench_v2_rs_updated.dsf")?;
    f_dsf.write_all(dsf_str.as_bytes())?;

    Ok(())
}

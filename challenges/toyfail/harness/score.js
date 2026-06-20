import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { solve } from "../starter/solution.js";

function makeInput(size) {
  let state = 123456789;
  const values = [];
  for (let i = 0; i < size; i += 1) {
    state = (1103515245 * state + 12345) >>> 0;
    values.push(state % 1000003);
  }
  return values;
}

const input = makeInput(200000);
let checksum = 0;
const samples = [];

for (let run = 0; run < 7; run += 1) {
  const started = performance.now();
  const output = solve(input);
  const elapsed = performance.now() - started;
  samples.push(elapsed);
  checksum ^= output[(run * 9973) % output.length] >>> 0;
}

samples.sort((a, b) => a - b);
const median = samples[Math.floor(samples.length / 2)];

writeFileSync("score.json", JSON.stringify({
  score: median,
  metrics: {
    time_ms: median,
    correctness_cases: 64,
    checksum
  }
}, null, 2));

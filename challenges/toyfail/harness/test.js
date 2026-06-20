import assert from "node:assert/strict";
import { solve } from "../starter/solution.js";

function reference(input) {
  return input.map((value) => {
    if (value % 3 === 0 || value % 5 === 0) {
      return value * value + 17;
    }
    return value + 11;
  });
}

function makeCase(seed, size) {
  let state = seed >>> 0;
  const values = [];
  for (let i = 0; i < size; i += 1) {
    state = (1664525 * state + 1013904223) >>> 0;
    values.push(state % 1000003);
  }
  return values;
}

let cases = 0;
for (let seed = 1; seed <= 64; seed += 1) {
  const input = makeCase(seed, 256);
  assert.deepEqual(solve(input), reference(input));
  cases += 1;
}

console.log(`toyfail: ${cases} public correctness cases passed`);

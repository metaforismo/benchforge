export function solve(input) {
  const output = [];
  for (const value of input) {
    if (value % 3 === 0 || value % 5 === 0) {
      output.push(value * value + 17);
    } else {
      output.push(value + 11);
    }
  }
  return output;
}

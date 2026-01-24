import { format } from './dsf.ts';

const input = `{
  title: \`Welcome to DSF\`
  features: [
    \`Fast\`
    \`Clean\`
    \`Type-Safe\`
  ]
  metrics: {
    reduction: 0.183
    isActive: T
  }
  timestamp: D(2026-01-17)
}`;

console.log("--- Input ---");
console.log(input);
console.log("\n--- Output ---");
console.log(format(input));

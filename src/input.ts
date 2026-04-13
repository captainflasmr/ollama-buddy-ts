import type { Interface as ReadlineInterface } from "node:readline/promises";

export async function askChoice(
  rl: ReadlineInterface,
  prompt: string,
  choices: string[],
): Promise<string | null> {
  if (choices.length === 0) return null;
  console.log(`\n${prompt}:`);
  for (let i = 0; i < choices.length; i++) {
    console.log(`  ${i + 1}) ${choices[i]}`);
  }
  const answer = await rl.question("Enter number (blank to cancel): ");
  const n = Number(answer);
  if (!Number.isInteger(n) || n < 1 || n > choices.length) return null;
  return choices[n - 1];
}

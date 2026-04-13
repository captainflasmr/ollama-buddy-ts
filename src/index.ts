#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { homedir } from "node:os";
import { join } from "node:path";
import { streamChat } from "./ollama.js";
import { buildMessages, createState } from "./state.js";
import { dispatchSlash } from "./slash.js";
import { newSessionId } from "./history.js";

const DEFAULT_MODEL = process.env.OLLAMA_BUDDY_MODEL ?? "llama3.2";
const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://localhost:11434";
const PROMPTS_DIR =
  process.env.OLLAMA_BUDDY_PROMPTS_DIR ??
  join(homedir(), "source/repos/ollama-buddy/ollama-buddy-user-prompts");

async function main(): Promise<void> {
  const state = createState(DEFAULT_MODEL, OLLAMA_HOST);
  const sessionId = { value: newSessionId() };
  const rl = createInterface({ input: stdin, output: stdout });

  console.log("ollama-buddy-ts — type /help for commands, /exit to quit");
  console.log(`model: ${state.model}    host: ${OLLAMA_HOST}`);
  console.log();

  try {
    while (true) {
      const label = state.systemPromptLabel
        ? `[${state.systemPromptLabel}] `
        : "";
      const line = (await rl.question(`${label}> `)).trim();
      if (!line) continue;

      if (line.startsWith("/")) {
        const result = await dispatchSlash(line, {
          rl,
          state,
          promptsDir: PROMPTS_DIR,
          sessionId,
        });
        if (result === "exit") return;
        continue;
      }

      state.messages.push({ role: "user", content: line });
      let reply = "";
      try {
        for await (const chunk of streamChat(
          state.ollamaHost,
          state.model,
          buildMessages(state),
        )) {
          stdout.write(chunk);
          reply += chunk;
        }
        stdout.write("\n\n");
      } catch (err) {
        console.error(`\nError: ${(err as Error).message}\n`);
        state.messages.pop();
        continue;
      }
      state.messages.push({ role: "assistant", content: reply });
    }
  } finally {
    rl.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

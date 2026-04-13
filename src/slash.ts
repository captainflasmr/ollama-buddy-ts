import type { Interface as ReadlineInterface } from "node:readline/promises";
import { listModels } from "./ollama.js";
import { loadPrompts } from "./prompts.js";
import {
  listSessions,
  loadSession,
  newSessionId,
  saveSession,
} from "./history.js";
import { askChoice } from "./input.js";
import type { State } from "./state.js";

export interface SlashContext {
  rl: ReadlineInterface;
  state: State;
  promptsDir: string;
  sessionId: { value: string };
}

export type SlashResult = "continue" | "exit";

type Handler = (ctx: SlashContext) => Promise<SlashResult>;

interface SlashCommand {
  desc: string;
  run: Handler;
}

export const slashCommands: Record<string, SlashCommand> = {
  model: {
    desc: "Switch to a different Ollama model",
    run: async (ctx) => {
      const models = await listModels(ctx.state.ollamaHost);
      if (models.length === 0) {
        console.log("(no models installed — try `ollama pull llama3.2`)");
        return "continue";
      }
      const choice = await askChoice(ctx.rl, "Pick a model", models);
      if (choice) {
        ctx.state.model = choice;
        console.log(`Model set to ${choice}`);
      }
      return "continue";
    },
  },

  system: {
    desc: "Load a system prompt from the prompts directory",
    run: async (ctx) => {
      const prompts = await loadPrompts(ctx.promptsDir);
      if (prompts.length === 0) {
        console.log(`(no prompts found in ${ctx.promptsDir})`);
        return "continue";
      }
      const choice = await askChoice(
        ctx.rl,
        "Pick a system prompt",
        prompts.map((p) => p.id),
      );
      if (choice) {
        const picked = prompts.find((p) => p.id === choice)!;
        ctx.state.systemPrompt = picked.body;
        ctx.state.systemPromptLabel = picked.title;
        console.log(`System prompt set to "${picked.title}"`);
      }
      return "continue";
    },
  },

  clear: {
    desc: "Clear the current conversation (keeps system prompt and model)",
    run: async (ctx) => {
      ctx.state.messages = [];
      ctx.sessionId.value = newSessionId();
      console.log("Conversation cleared.");
      return "continue";
    },
  },

  history: {
    desc: "Save, list, or load past sessions",
    run: async (ctx) => {
      const action = await askChoice(ctx.rl, "History", [
        "save",
        "list",
        "load",
      ]);
      if (action === "save") {
        const file = await saveSession({
          id: ctx.sessionId.value,
          createdAt: new Date().toISOString(),
          model: ctx.state.model,
          systemPrompt: ctx.state.systemPrompt,
          systemPromptLabel: ctx.state.systemPromptLabel,
          messages: ctx.state.messages,
        });
        console.log(`Saved to ${file}`);
      } else if (action === "list") {
        const sessions = await listSessions();
        if (sessions.length === 0) {
          console.log("(no saved sessions)");
        } else {
          for (const s of sessions) {
            const first = s.messages.find((m) => m.role === "user");
            const preview = first?.content.slice(0, 60) ?? "(empty)";
            console.log(`  ${s.id}  [${s.model}]  ${preview}`);
          }
        }
      } else if (action === "load") {
        const sessions = await listSessions();
        if (sessions.length === 0) {
          console.log("(no saved sessions)");
          return "continue";
        }
        const pick = await askChoice(
          ctx.rl,
          "Pick a session",
          sessions.map((s) => s.id),
        );
        if (pick) {
          const s = await loadSession(pick);
          if (s) {
            ctx.state.model = s.model;
            ctx.state.systemPrompt = s.systemPrompt;
            ctx.state.systemPromptLabel = s.systemPromptLabel;
            ctx.state.messages = s.messages;
            ctx.sessionId.value = s.id;
            console.log(
              `Loaded ${s.id} — ${s.messages.length} messages, model ${s.model}`,
            );
          }
        }
      }
      return "continue";
    },
  },

  exit: {
    desc: "Quit the chat",
    run: async () => "exit",
  },

  help: {
    desc: "Show available slash commands",
    run: async () => {
      console.log();
      for (const [name, cmd] of Object.entries(slashCommands)) {
        console.log(`  /${name.padEnd(10)} ${cmd.desc}`);
      }
      console.log();
      return "continue";
    },
  },
};

export async function dispatchSlash(
  line: string,
  ctx: SlashContext,
): Promise<SlashResult> {
  const name = line.slice(1).trim().split(/\s+/)[0];
  const cmd = slashCommands[name];
  if (!cmd) {
    console.log(`Unknown command: /${name}. Try /help.`);
    return "continue";
  }
  return cmd.run(ctx);
}

import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Message } from "./state.js";

export interface Session {
  id: string;
  createdAt: string;
  model: string;
  systemPrompt: string | null;
  systemPromptLabel: string | null;
  messages: Message[];
}

const historyDir = join(homedir(), ".ollama-buddy-ts", "history");

export async function saveSession(session: Session): Promise<string> {
  await mkdir(historyDir, { recursive: true });
  const file = join(historyDir, `${session.id}.json`);
  await writeFile(file, JSON.stringify(session, null, 2), "utf8");
  return file;
}

export async function listSessions(): Promise<Session[]> {
  try {
    const files = await readdir(historyDir);
    const sessions: Session[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const raw = await readFile(join(historyDir, f), "utf8");
      sessions.push(JSON.parse(raw) as Session);
    }
    sessions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sessions;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function loadSession(id: string): Promise<Session | null> {
  try {
    const raw = await readFile(join(historyDir, `${id}.json`), "utf8");
    return JSON.parse(raw) as Session;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export function newSessionId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

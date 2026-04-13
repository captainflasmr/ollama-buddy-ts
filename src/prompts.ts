import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

export interface Prompt {
  id: string;
  title: string;
  category: string;
  body: string;
  file: string;
}

export async function loadPrompts(dir: string): Promise<Prompt[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith(".org"))
    .map((e) => join(dir, e.name));

  const prompts: Prompt[] = [];
  for (const file of files) {
    const raw = await readFile(file, "utf8");
    prompts.push(parsePrompt(file, raw));
  }
  prompts.sort((a, b) => a.id.localeCompare(b.id));
  return prompts;
}

function parsePrompt(file: string, raw: string): Prompt {
  const lines = raw.split("\n");
  let title = "";
  let category = "";
  let bodyStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const header = /^#\+(\w+):\s*(.*)$/.exec(line);
    if (header) {
      const key = header[1].toUpperCase();
      if (key === "TITLE") title = header[2].trim();
      if (key === "CATEGORY") category = header[2].trim();
      bodyStart = i + 1;
      continue;
    }
    if (line.trim() === "") {
      bodyStart = i + 1;
      continue;
    }
    break;
  }

  const body = lines.slice(bodyStart).join("\n").trim();
  const base = basename(file);
  const match = /^([^_]+)__(.+?)__system\.org$/.exec(base);
  if (!title && match) title = match[2].replace(/-/g, " ");
  if (!category && match) category = match[1];
  const id = category ? `${category}/${title}` : title;

  return { id, title, category, body, file };
}

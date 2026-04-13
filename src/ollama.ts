import type { Message } from "./state.js";

interface ChatChunk {
  message?: { role: string; content: string };
  done: boolean;
}

export async function* streamChat(
  host: string,
  model: string,
  messages: Message[],
  signal?: AbortSignal,
): AsyncGenerator<string, void, void> {
  const res = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Ollama returned ${res.status}: ${await res.text()}`);
  }
  if (!res.body) {
    throw new Error("Ollama response had no body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const chunk = JSON.parse(line) as ChatChunk;
        if (chunk.message?.content) {
          yield chunk.message.content;
        }
      } catch {
        // Ignore malformed JSON lines; Ollama emits one JSON object per line.
      }
    }
  }
}

export async function listModels(host: string): Promise<string[]> {
  const res = await fetch(`${host}/api/tags`);
  if (!res.ok) throw new Error(`Ollama /api/tags returned ${res.status}`);
  const data = (await res.json()) as { models?: { name: string }[] };
  return (data.models ?? []).map((m) => m.name).sort();
}

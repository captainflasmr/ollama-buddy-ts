export type Role = "system" | "user" | "assistant";

export interface Message {
  role: Role;
  content: string;
}

export interface State {
  model: string;
  systemPrompt: string | null;
  systemPromptLabel: string | null;
  messages: Message[];
  ollamaHost: string;
}

export function createState(model: string, ollamaHost: string): State {
  return {
    model,
    systemPrompt: null,
    systemPromptLabel: null,
    messages: [],
    ollamaHost,
  };
}

export function buildMessages(state: State): Message[] {
  const msgs: Message[] = [];
  if (state.systemPrompt) {
    msgs.push({ role: "system", content: state.systemPrompt });
  }
  msgs.push(...state.messages);
  return msgs;
}

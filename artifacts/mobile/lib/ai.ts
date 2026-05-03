import { fetch as expoFetch } from "expo/fetch";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export interface AiChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function streamChat(
  messages: AiChatMessage[],
  onChunk: (delta: string) => void,
): Promise<string> {
  const res = await expoFetch(`${API_BASE}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Chat failed: ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";
  const flushLines = (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (!payload) continue;
      try {
        const obj = JSON.parse(payload) as { content?: string; done?: boolean };
        if (obj.content) {
          full += obj.content;
          onChunk(obj.content);
        }
      } catch {
        // ignore malformed line
      }
    }
  };
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    flushLines(decoder.decode(value, { stream: true }));
  }
  // Flush any remaining bytes from the decoder and trailing buffered line.
  flushLines(decoder.decode());
  if (buffer.length > 0) flushLines("\n");
  return full;
}

export async function analyzePhoto(
  base64: string,
  prompt: string,
): Promise<string> {
  const res = await expoFetch(`${API_BASE}/api/ai/vision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64, prompt }),
  });
  if (!res.ok) throw new Error(`Vision failed: ${res.status}`);
  const json = (await res.json()) as { text: string };
  return json.text;
}

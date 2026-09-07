import { fetch as expoFetch } from "expo/fetch";
import { authHeaders } from "@/lib/api";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export interface MailMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  body?: { content: string; contentType: string };
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  isRead: boolean;
  hasAttachments: boolean;
}

export async function fetchInbox(opts?: {
  top?: number;
  filter?: string;
}): Promise<MailMessage[]> {
  const params = new URLSearchParams();
  if (opts?.top) params.set("top", String(opts.top));
  if (opts?.filter) params.set("filter", opts.filter);

  const res = await expoFetch(`${API_BASE}/api/mail/inbox?${params.toString()}`, {
    method: "GET",
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { messages: MailMessage[] };
  return data.messages ?? [];
}

export async function fetchMessage(id: string): Promise<MailMessage> {
  const res = await expoFetch(`${API_BASE}/api/mail/message/${encodeURIComponent(id)}`, {
    method: "GET",
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { message: MailMessage };
  return data.message;
}

export async function markAsRead(id: string): Promise<void> {
  await expoFetch(`${API_BASE}/api/mail/message/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    headers: await authHeaders(),
  });
}

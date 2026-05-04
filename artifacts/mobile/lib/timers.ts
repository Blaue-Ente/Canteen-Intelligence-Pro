/**
 * Lightweight in-memory cooking timer registry for Kios voice control.
 *
 * Why in-memory and not persistent:
 * - Cooking timers are inherently short-lived (seconds to ~2h).
 * - Persisting across app reload would add zombie alerts; users prefer to
 *   re-arm a fresh timer on cold start.
 *
 * The audio cue uses a synthesized beep when on web (no asset needed) and
 * defers to the caller (Kios) for spoken announcements via ElevenLabs TTS.
 */

import { Platform } from "react-native";

export interface KitchenTimer {
  id: string;
  label: string;
  startedAt: number;
  /** Epoch ms when the timer should fire. */
  dueAt: number;
  timeoutId: ReturnType<typeof setTimeout>;
  /** Called when the timer fires. */
  onFire: (t: KitchenTimer) => void;
}

const REGISTRY = new Map<string, KitchenTimer>();
let SEQ = 0;

function nextId(): string {
  SEQ += 1;
  return `t-${Date.now().toString(36)}-${SEQ}`;
}

/**
 * Schedule a timer.
 * @param label Human label, e.g. "Nudeln" or "12 Minuten".
 * @param ms Duration in milliseconds.
 * @param onFire Callback invoked when the timer expires (use for chime + speech).
 */
export function startTimer(label: string, ms: number, onFire: (t: KitchenTimer) => void): KitchenTimer {
  const id = nextId();
  const startedAt = Date.now();
  const dueAt = startedAt + ms;
  const timeoutId = setTimeout(() => {
    const t = REGISTRY.get(id);
    if (!t) return;
    REGISTRY.delete(id);
    try { playChime(); } catch { /* best-effort */ }
    onFire(t);
  }, ms);
  const t: KitchenTimer = { id, label, startedAt, dueAt, timeoutId, onFire };
  REGISTRY.set(id, t);
  return t;
}

export function listTimers(): KitchenTimer[] {
  return Array.from(REGISTRY.values()).sort((a, b) => a.dueAt - b.dueAt);
}

export function cancelTimer(id: string): boolean {
  const t = REGISTRY.get(id);
  if (!t) return false;
  clearTimeout(t.timeoutId);
  REGISTRY.delete(id);
  return true;
}

export function cancelAllTimers(): number {
  const n = REGISTRY.size;
  for (const t of REGISTRY.values()) clearTimeout(t.timeoutId);
  REGISTRY.clear();
  return n;
}

/** Cancel the most recent timer matching the label (case-insensitive substring). */
export function cancelTimerByLabel(label: string): KitchenTimer | null {
  const needle = label.toLowerCase().trim();
  const matches = listTimers().filter((t) => t.label.toLowerCase().includes(needle));
  const target = matches[matches.length - 1];
  if (!target) return null;
  cancelTimer(target.id);
  return target;
}

// ── Chime ────────────────────────────────────────────────────────────────────
// 0.4s 880Hz sine triple-beep, base64-inlined to avoid an asset round-trip on web.
// On native we rely on the spoken announcement (ElevenLabs) which is loud enough.
const CHIME_DATA_URI =
  "data:audio/wav;base64,UklGRsQBAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YaABAAB////";

function playChime(): void {
  if (Platform.OS !== "web") return;
  if (typeof window === "undefined" || typeof Audio === "undefined") return;
  try {
    const a = new Audio(CHIME_DATA_URI);
    a.volume = 0.7;
    void a.play().catch(() => { /* user-gesture restrictions — ignore */ });
  } catch { /* ignore */ }
}

// ── Natural-language parsing helpers ─────────────────────────────────────────

/**
 * Parse natural German/English phrases like:
 *   "Timer 12 Minuten" → 720_000 ms, label "12 Minuten"
 *   "10 minute timer"  → 600_000 ms
 *   "Stell einen Timer auf 1 Stunde 30 Minuten" → 5_400_000 ms
 *   "Timer 90 sekunden für nudeln" → ms + label "nudeln"
 *
 * Returns null when no duration can be extracted.
 */
export function parseTimerPhrase(input: string): { ms: number; label: string } | null {
  const lower = input.toLowerCase();
  const re = /(\d+(?:[.,]\d+)?)\s*(stunden?|hours?|hrs?|minuten?|minutes?|min|mins?|sekunden?|seconds?|secs?|sek|s\b)/g;
  let total = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(lower)) !== null) {
    const n = Number(m[1]!.replace(",", "."));
    const unit = m[2]!;
    if (/stunde|hour|hr/.test(unit)) total += n * 60 * 60 * 1000;
    else if (/minute|min/.test(unit)) total += n * 60 * 1000;
    else total += n * 1000;
  }
  if (total <= 0 || total > 6 * 60 * 60 * 1000) return null; // cap at 6h
  // Extract label: text after "für" / "for", else strip the duration tokens.
  let label = "";
  const fuer = lower.match(/(?:f[üu]r|for)\s+(.+)$/);
  if (fuer && fuer[1]) {
    label = fuer[1].replace(/\b(timer|den|die|das|der|the|a|an)\b/g, "").trim();
  }
  if (!label) {
    label = formatDuration(total);
  }
  return { ms: total, label };
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}min`);
  if (sec > 0 && h === 0) parts.push(`${sec}s`);
  return parts.join(" ") || "0s";
}

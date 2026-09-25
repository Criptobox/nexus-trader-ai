/**
 * NEXUS Market Memory 2.1
 *
 * Local-first memory for market situations, decisions and lessons.
 * Deterministic storage; no LLM is required to write/read records.
 */

export type MarketMemoryRecord = {
  id: string;
  symbol: string;
  timeframe?: string;
  timestamp: number;
  tags: string[];
  regime?: "bull" | "bear" | "sideways" | "high-volatility" | "unknown";
  features: Record<string, number | string | boolean>;
  decision?: "long" | "short" | "hold" | "avoid";
  outcome?: "pending" | "positive" | "negative" | "neutral";
  importance: number;
  lesson?: string;
};

const KEY = "nexus.market-memory.v2";
const MAX_RECORDS = 2000;

function load(): MarketMemoryRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function save(records: MarketMemoryRecord[]) {
  localStorage.setItem(KEY, JSON.stringify(records.slice(-MAX_RECORDS)));
}

function tokenize(value: unknown): string[] {
  return String(value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9_]+/i)
    .filter(Boolean);
}

function similarity(a: MarketMemoryRecord, b: Partial<MarketMemoryRecord>): number {
  let score = 0;
  let max = 0;

  if (b.symbol) {
    max += 3;
    if (a.symbol.toLowerCase() === b.symbol.toLowerCase()) score += 3;
  }
  if (b.timeframe) {
    max += 2;
    if (a.timeframe === b.timeframe) score += 2;
  }
  if (b.regime) {
    max += 2;
    if (a.regime === b.regime) score += 2;
  }

  const bt = new Set((b.tags ?? []).flatMap(tokenize));
  const at = new Set(a.tags.flatMap(tokenize));
  if (bt.size) {
    max += 3;
    let overlap = 0;
    bt.forEach(t => { if (at.has(t)) overlap++; });
    score += Math.min(3, overlap);
  }

  const bf = b.features ?? {};
  const af = a.features ?? {};
  const numeric = Object.keys(bf).filter(k =>
    typeof bf[k] === "number" && typeof af[k] === "number"
  );
  if (numeric.length) {
    for (const k of numeric) {
      max += 1;
      const x = Number(bf[k]), y = Number(af[k]);
      const scale = Math.max(Math.abs(x), Math.abs(y), 1);
      score += Math.max(0, 1 - Math.abs(x-y) / scale);
    }
  }

  const recency = Math.max(0, 1 - (Date.now() - a.timestamp) / (1000*60*60*24*90));
  score += recency * 0.5;
  max += 0.5;

  return max ? score / max : 0;
}

export const marketMemory = {
  list(): MarketMemoryRecord[] {
    return load();
  },

  add(record: Omit<MarketMemoryRecord, "id" | "timestamp"> & { timestamp?: number }): MarketMemoryRecord {
    const item: MarketMemoryRecord = {
      ...record,
      id: `mm_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      timestamp: record.timestamp ?? Date.now(),
      importance: Math.max(0, Math.min(1, record.importance ?? 0.5)),
    };
    const records = load();
    records.push(item);
    save(records);
    return item;
  },

  findSimilar(query: Partial<MarketMemoryRecord>, limit = 8) {
    return load()
      .map(r => ({ record: r, similarity: similarity(r, query) }))
      .sort((a,b) => b.similarity - a.similarity)
      .slice(0, limit);
  },

  updateOutcome(id: string, outcome: MarketMemoryRecord["outcome"], lesson?: string) {
    const records = load();
    const idx = records.findIndex(r => r.id === id);
    if (idx < 0) return false;
    records[idx].outcome = outcome;
    if (lesson) records[idx].lesson = lesson;
    save(records);
    return true;
  },

  clear() {
    localStorage.removeItem(KEY);
  }
};

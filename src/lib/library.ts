import { api } from "./db";
import { getEmbedding, cosineSimilarity } from "./ai";

export interface LibraryPack {
  id: string;
  title: string;
  author: string;
  topics: string[];
  chunkCount: number;
  version: string;
  installedAt?: string;
}

export interface LibraryChunk {
  id: string;
  packId: string;
  text: string;
  metadata: Record<string, any>;
  embedding?: number[];
}

const PACKS_KEY = "raiva_library_packs";
const CHUNKS_KEY = "raiva_library_chunks";

function loadPacks(): LibraryPack[] {
  try { return JSON.parse(localStorage.getItem(PACKS_KEY) || "[]"); }
  catch { return []; }
}

function savePacks(p: LibraryPack[]) {
  localStorage.setItem(PACKS_KEY, JSON.stringify(p));
}

function loadChunks(): LibraryChunk[] {
  try { return JSON.parse(localStorage.getItem(CHUNKS_KEY) || "[]"); }
  catch { return []; }
}

function saveChunks(c: LibraryChunk[]) {
  localStorage.setItem(CHUNKS_KEY, JSON.stringify(c));
}

export const library = {

  getInstalledPacks(): LibraryPack[] {
    return loadPacks();
  },

  async installPack(pack: Omit<LibraryPack, "installedAt">, chunks: Omit<LibraryChunk, "packId">[]): Promise<void> {
    const packs = loadPacks();
    if (packs.find((p) => p.id === pack.id)) return;
    packs.push({ ...pack, installedAt: new Date().toISOString() });
    savePacks(packs);

    const existing = loadChunks();
    for (const c of chunks) {
      existing.push({ ...c, packId: pack.id });
    }
    saveChunks(existing);
  },

  removePack(packId: string): void {
    const packs = loadPacks().filter((p) => p.id !== packId);
    savePacks(packs);
    const chunks = loadChunks().filter((c) => c.packId !== packId);
    saveChunks(chunks);
  },

  async searchLibrary(query: string, packIds?: string[], topK = 5): Promise<LibraryChunk[]> {
    const qEmb = await getEmbedding(query);
    let chunks = loadChunks();
    if (packIds && packIds.length > 0) {
      chunks = chunks.filter((c) => packIds.includes(c.packId));
    }
    const scored = chunks.map((c) => ({
      chunk: c,
      score: c.embedding ? cosineSimilarity(qEmb, c.embedding!) : 0,
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK).map((s) => s.chunk);
  },

  async searchAll(query: string, topK = 5): Promise<LibraryChunk[]> {
    return library.searchLibrary(query, undefined, topK);
  },

  // Built-in starter packs
  getStarterPacks() {
    return STARTER_PACKS;
  },

  async installStarterPack(packId: string): Promise<void> {
    const pack = STARTER_PACKS.find((p) => p.id === packId);
    if (!pack) throw new Error(`Pack ${packId} not found`);
    await library.installPack(pack, pack.chunks);
  },
};

const PACK_CHUNKS_COPYWRITING: Omit<LibraryChunk, "packId">[] = [
  {
    id: "copy-001", text: "The Grand Slam Offer: Make them an offer so good they feel stupid saying no. The offer is the product. Most people focus on the product features. The offer is everything — price, terms, guarantees, bonuses, delivery. Stack value until the perceived value is 10x the price.",
    metadata: { book: "100M Offers", author: "Alex Hormozi", chapter: "The Offer" },
  },
  {
    id: "copy-002", text: "Value Equation: The four variables that determine perceived value: (1) Dream outcome — how good will the result be? (2) Perceived likelihood of achievement — will they believe they can get it? (3) Time delay — how long until they get it? (4) Effort and sacrifice — what do they have to give up?",
    metadata: { book: "100M Offers", author: "Alex Hormozi", chapter: "Value" },
  },
  {
    id: "copy-003", text: "Price is a signal of value. If you lower your prices, you signal lower value. The price is not the problem — the offer is. If people aren't buying, improve the offer, don't lower the price. Add more value, reduce risk with guarantees, stack bonuses.",
    metadata: { book: "100M Offers", author: "Alex Hormozi", chapter: "Pricing" },
  },
  {
    id: "copy-004", text: "The Big Idea: Find a single, powerful idea that stops people, makes them think, and changes how they see the world. A big idea is something new — a new way of doing things, a new philosophy, a new principle. It must be specific enough to be remembered.",
    metadata: { book: "Ogilvy on Advertising", author: "David Ogilvy", chapter: "Big Ideas" },
  },
  {
    id: "copy-005", text: "Headlines: On average, five times as many people read the headline as read the body copy. If you haven't done some selling in the headline, you've wasted 80% of your money. The headline must promise a benefit that is specific, useful, and desirable.",
    metadata: { book: "Ogilvy on Advertising", author: "David Ogilvy", chapter: "Headlines" },
  },
  {
    id: "copy-006", text: "Scientific Advertising: The only purpose of advertising is to make sales. It is not for entertainment, not for creativity, not for awards. Every element of the ad must be tested. The advertiser who tests scientifically will outperform the one who guesses.",
    metadata: { book: "Scientific Advertising", author: "Claude Hopkins", chapter: "Principles" },
  },
  {
    id: "copy-007", text: "Specificity: Vague statements have no power. 'Larger' means nothing. 'Half an inch larger' means everything. Give specific numbers, specific benefits, specific proof. The more specific you are, the more believable you become.",
    metadata: { book: "Scientific Advertising", author: "Claude Hopkins", chapter: "Specifics" },
  },
  {
    id: "copy-008", text: "Reason-Why Copy: Give people a reason to buy. People justify their purchases with logic even if they buy on emotion. Provide reasons, evidence, testimonials, demonstrations. The more reasons you give, the easier it is for them to say yes.",
    metadata: { book: "The Robert Collier Letter Book", author: "Robert Collier", chapter: "Reason Why" },
  },
];

const PACK_CHUNKS_PRODUCT: Omit<LibraryChunk, "packId">[] = [
  {
    id: "prod-001", text: "The product is the result of the process. If you focus on the process — the daily habits, the systems, the team culture — the product will take care of itself. Most failures come from focusing on the output instead of the system that produces it.",
    metadata: { book: "Inspired", author: "Marty Cagan", chapter: "Product Teams" },
  },
  {
    id: "prod-002", text: "Product discovery is the process of separating good ideas from bad ideas before you build them. Every product team should spend time on discovery every week. The goal is to reduce risk: value risk (will they buy?), usability risk (can they use it?), feasibility risk (can we build it?), viability risk (should we build it?).",
    metadata: { book: "Inspired", author: "Marty Cagan", chapter: "Discovery" },
  },
  {
    id: "prod-003", text: "Outcome over output. It doesn't matter how many features you ship. What matters is whether those features change customer behavior in the way you intended. Measure outcomes, not output. If a feature doesn't move the metric, kill it.",
    metadata: { book: "Escaping the Build Trap", author: "Melissa Perri", chapter: "Outcomes" },
  },
  {
    id: "prod-004", text: "Jobs to Be Done: People don't buy products; they hire them to do a job. When you understand the job the customer is trying to get done, you can design a product that does it better than any alternative. The job is stable over time; the solution evolves.",
    metadata: { book: "Competing Against Luck", author: "Clayton Christensen", chapter: "JTBD" },
  },
];

const PACK_CHUNKS_STRATEGY: Omit<LibraryChunk, "packId">[] = [
  {
    id: "strat-001", text: "The core competence of the organization: what can we do better than anyone else? Strategy is not about doing more things — it's about focusing your resources on the few things that create disproportionate value. Concentration of effort is the key to competitive advantage.",
    metadata: { book: "Good to Great", author: "Jim Collins", chapter: "Hedgehog Concept" },
  },
  {
    id: "strat-002", text: "The Hedgehog Concept: Three intersecting circles — what you are deeply passionate about, what you can be the best in the world at, and what drives your economic engine. The strategy lives at the intersection. If you can't be the best, don't do it.",
    metadata: { book: "Good to Great", author: "Jim Collins", chapter: "Hedgehog" },
  },
  {
    id: "strat-003", text: "First principles thinking: Boil things down to the most fundamental truths and reason up from there. Don't reason by analogy. Most people think in analogies — 'it's like X, so we should do Y.' First principles thinking asks: what is fundamentally true here?",
    metadata: { book: "Thinking from First Principles", author: "Various", chapter: "Method" },
  },
  {
    id: "strat-004", text: "The Innovator's Dilemma: Incumbents fail not because they make bad decisions, but because they make good decisions that happen to be wrong for the disruptive future. The very practices that make them successful make them vulnerable to disruption from below.",
    metadata: { book: "The Innovator's Dilemma", author: "Clayton Christensen", chapter: "Disruption" },
  },
  {
    id: "strat-005", text: "Sun Tzu: If you know the enemy and know yourself, you need not fear the result of a hundred battles. If you know yourself but not the enemy, for every victory gained you will also suffer a defeat. If you know neither, you will lose every battle.",
    metadata: { book: "The Art of War", author: "Sun Tzu", chapter: "Planning" },
  },
  {
    id: "strat-006", text: "Miyamoto Musashi: There is timing in everything. You must understand the timing of things. In strategy, there is the timing of going first and the timing of going second. There is the timing of attacking and the timing of retreating. Perceive the timing of your opponent.",
    metadata: { book: "The Book of Five Rings", author: "Miyamoto Musashi", chapter: "Timing" },
  },
];

const PACK_CHUNKS_WRITING: Omit<LibraryChunk, "packId">[] = [
  {
    id: "write-001", text: "The purpose of writing is to communicate an idea from your mind to the reader's mind with minimal loss. Every word that doesn't serve that purpose is noise. Cut every word that is not doing work. Short sentences. Simple words. Clear thinking.",
    metadata: { book: "On Writing Well", author: "William Zinsser", chapter: "Simplicity" },
  },
  {
    id: "write-002", text: "The reader's attention is your most scarce resource. Every sentence must earn its place. If a sentence can be removed without losing meaning, remove it. If a paragraph can be reduced to a sentence, reduce it. If a word can be cut, cut it.",
    metadata: { book: "The Elements of Style", author: "Strunk & White", chapter: "Omit Needless Words" },
  },
  {
    id: "write-003", text: "Show, don't tell. Instead of 'he was angry', show his clenched fists, his raised voice, his red face. Instead of 'the product is high quality', show the materials, the testing process, the warranty. Concrete specifics are infinitely more persuasive than abstract claims.",
    metadata: { book: "Steal Like an Artist", author: "Austin Kleon", chapter: "Show Your Work" },
  },
];

const STARTER_PACKS: (LibraryPack & { chunks: Omit<LibraryChunk, "packId">[] })[] = [
  {
    id: "copywriting-masters",
    title: "Copywriting Masters",
    author: "Hormozi, Ogilvy, Hopkins & Collier",
    topics: ["copywriting", "marketing", "sales", "persuasion"],
    chunkCount: PACK_CHUNKS_COPYWRITING.length,
    version: "1.0.0",
    chunks: PACK_CHUNKS_COPYWRITING,
  },
  {
    id: "product-management",
    title: "Product Management",
    author: "Cagan, Perri & Christensen",
    topics: ["product", "management", "startup", "innovation"],
    chunkCount: PACK_CHUNKS_PRODUCT.length,
    version: "1.0.0",
    chunks: PACK_CHUNKS_PRODUCT,
  },
  {
    id: "strategy-masters",
    title: "Strategy & Leadership",
    author: "Collins, Sun Tzu, Musashi & Christensen",
    topics: ["strategy", "leadership", "business", "war"],
    chunkCount: PACK_CHUNKS_STRATEGY.length,
    version: "1.0.0",
    chunks: PACK_CHUNKS_STRATEGY,
  },
  {
    id: "writing-craft",
    title: "Writing Craft",
    author: "Zinsser, Strunk & Kleon",
    topics: ["writing", "creativity", "editing", "style"],
    chunkCount: PACK_CHUNKS_WRITING.length,
    version: "1.0.0",
    chunks: PACK_CHUNKS_WRITING,
  },
];

export async function getLibraryContext(query: string, maxChunks = 3): Promise<string> {
  const results = await library.searchAll(query, maxChunks);
  if (results.length === 0) return "";
  let ctx = "\n--- LIBRARY REFERENCES ---\n";
  for (const r of results) {
    const src = r.metadata?.book || r.metadata?.author || "Library";
    ctx += `[${src}] ${r.text}\n\n`;
  }
  return ctx.trim();
}

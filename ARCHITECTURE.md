# RAIVA OS — AI Architecture

## Overview

RAIVA OS uses a **cascade architecture** with tiered model deployment, multi-source RAG, and a structured tool system. The design prioritizes:

- **100% offline capability** across all platforms
- **Runs on 4-8GB devices** (the majority of the market)
- **Privacy-first**: zero data leaves the device unless the user explicitly opts in
- **Progressive enhancement**: functional immediately, gets smarter as the user adds data

---

## 1. The Model Strategy (Three-Tier Progressive)

| Tier | Name | RAM Budget | Device Targets | Always-Resident | On-Demand |
|---|---|---|---|---|---|
| **Light** | RAIVA Micro | ~1GB free | 4GB phones, Chromebooks, 2-in-1s | 0.5B Dense Q4 (300MB) | 1.5B Q4 (1GB) |
| **Standard** | RAIVA | ~4GB free | 8GB laptops (80% of market) | **MoE 2.7B Q4** (1.5GB) | 7B Q3_K_M (3.5GB) |
| **Pro** | RAIVA Pro | ~10GB free | 16-32GB workstations | 3B Dense Q4 (2.2GB) | 13B Q4 (7GB) / 70B Q4 (40GB) |

**Auto-detection**: On first launch, the app measures total system RAM and recommends a tier. The user can override.

### 1.1 MoE as the Standard Brain

The Standard tier uses a **Mixture-of-Experts** model (e.g., Qwen2.5-MoE-A2.7B) that activates ~1.3B parameters per token. This gives near-3B-dense quality at ~1.5B-dense RAM cost. The MoE is the always-resident model on 8GB machines.

### 1.2 Model Delivery

No model is bundled in the binary. On first launch:
1. App works immediately in **template-only mode** (deterministic intent matching — no neural inference)
2. Background downloader fetches the appropriate model
3. User sees a progress bar and can continue using the app during download
4. Once downloaded, AI upgrades seamlessly to generative responses

---

## 2. The Cascade Decision Flow

```
User message
    │
    ▼
┌──────────────────────┐
│  1. Classifier       │ ← 0.5B or MoE always-resident
│                      │
│  "data query"        │──→ Template engine (instantly, no generation)
│  "simple gen"        │──→ Always-resident model generates
│  "complex"           │──→ Load larger model from disk → generate → unload
│  "tool exec"         │──→ Execute directly, no generation needed
└──────────────────────┘
```

### Classifier Labels

| Label | Example | Handler | Latency |
|---|---|---|---|
| `data_query` | "How many tasks are due?" | Template (regex + DB query) | <10ms |
| `simple_gen` | "Summarize this note" | Always-resident model | 0.5-2s |
| `complex` | "Help me plan Q3 strategy" | Load 7B → generate → unload | 3-15s |
| `tool_exec` | "Add a task called Buy milk" | Execute tool directly (no model) | <50ms |
| `library_query` | "What does Hormozi say about pricing?" | Library RAG → always-resident model | 1-3s |
| `unknown` | General chat | Always-resident model with RAG | 1-3s |

### Load/Unload Policy (Standard & Pro)

- **Always-resident model** stays in RAM permanently (~300MB for 0.5B, ~1.5GB for MoE)
- **On-demand model** loaded from disk when classifier says `complex`
- After inference completes → model is unloaded
- OS page cache keeps the file hot for ~30s; re-load within that window is near-instant
- After 60s idle, memory fully reclaimed

---

## 3. RAG Pipeline (The Force Multiplier)

The RAG system is the core of RAIVA's intelligence. It compensates for the small model size by providing highly relevant context.

```
[Query]
    │
    ▼
┌─────────────────────────┐
│ 1. Query Rewriting      │
│    Raw query → expanded │
│    search terms          │
└──────────────────┬──────┘
                   ▼
┌─────────────────────────┐
│ 2. Multi-Source Retrieval│
│                         │
│   ┌─────────────────┐   │
│   │ User Notes       │   │ ← cosine similarity over embeddings
│   └─────────────────┘   │
│   ┌─────────────────┐   │
│   │ Library Packs    │   │ ← same embedding space, domain-filtered
│   └─────────────────┘   │
│   ┌─────────────────┐   │
│   │ Knowledge Tree   │   │ ← mentor influences matching query domain
│   └─────────────────┘   │
│   ┌─────────────────┐   │
│   │ App Entities     │   │ ← tasks, projects, habits structured data
│   └─────────────────┘   │
└──────────────────┬──────┘
                   ▼
┌─────────────────────────┐
│ 3. Reranking            │
│    Top-20 candidates →  │
│    cross-encoder → top-5│
└──────────────────┬──────┘
                   ▼
┌─────────────────────────┐
│ 4. Context Assembly     │
│    System prompt +      │
│    top-5 chunks +       │
│    structured data →    │
│    model generates      │
└─────────────────────────┘
```

### 3.1 Embedding Storage

Embeddings are stored as BLOBs in SQLite alongside their source entities:

```sql
CREATE TABLE embeddings (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,   -- 'note', 'library_chunk', 'pack_chunk'
  source_id TEXT NOT NULL,     -- FK to the source entity
  embedding BLOB NOT NULL,     -- float32 array
  chunk_text TEXT,             -- the original text (for library/pack chunks)
  metadata TEXT,               -- JSON: position, context, etc.
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 3.2 Chunking Strategy

- **Long notes**: Split at sentence boundaries into 512-token chunks with 64-token overlap
- **Library content**: Same chunking, but chunks have additional metadata (book title, chapter, page)
- **Pre-built packs**: Come pre-chunked and pre-embedded — no processing needed

### 3.3 Hybrid Search

Combines:
- **Semantic search** (cosine similarity over embeddings) — weight: 0.7
- **Keyword/BM25 search** — weight: 0.3

Final score = 0.7 × semantic_similarity + 0.3 × keyword_score

---

## 4. Tool System

The model interacts with the app through structured tool calls, not by writing data directly. This ensures safety, auditability, and correctness.

### 4.1 Tool Definitions

```
search_notes(query, limit=5)        → semantic note search
search_library(query, pack_ids?, limit=5)
get_tasks(status?, quadrant?)       → query tasks
get_projects()                       → all projects
get_habits()
get_visions()
get_goals(project_id?)
create_task(title, quadrant?, duration_mins?, description?)
create_project(title, description?, color?)
create_goal(title, project_id)
create_note(title, content?, tags?)
create_habit(name, icon?, color?)
update_task(id, fields)
update_project(id, fields)
update_goal(id, fields)
delete_task(id)
delete_project(id)
delete_goal(id)
delete_note(id)
web_search(query)                    → permission-gated (Always/Ask/Never)
life_audit()                         → run alignment algorithm
knowledge_tree_search(topic)         → search mentor influences
```

### 4.2 Tool Call Format (Grammar-Constrained)

The model outputs structured tool calls:

```
TOOL: search_notes("quarterly budget review")
TOOL: get_tasks(status="in-progress")
───
Result: Found 3 notes about budget...
───
TOOL: create_task(title="Review Q2 budget with team", project_id="proj_123")
```

In the browser implementation (deterministic fallback), tools are called via structured command matching. In the Tauri backend with real LLMs, grammar-constrained generation (GBNF) forces valid tool call syntax.

### 4.3 Permission System

Tools are categorized:

| Category | Examples | Permission Required |
|---|---|---|
| Read | search_notes, get_tasks | Never (always allowed) |
| Write | create_*, update_*, delete_* | Confirmation dialog on first call per session |
| External | web_search | Always/Ask/Never setting |
| System | life_audit | Never (always allowed) |

---

## 5. Library System

The Library is a collection of reference content (books, articles, courses) that the AI can search and use in its responses. Content exists in two forms:

### 5.1 Pre-built Packs (.raivapack)

Professionally curated content packs distributed as ZIP files:

```
pack_name.raivapack
├── metadata.json        # title, author, topics, chunk_count, version
├── chunks/
│   ├── index.json       # chunk_id → {embedding_offset, text_offset, metadata}
│   ├── 0001.emb         # float32 embedding (128-384 dim, pre-computed)
│   ├── 0001.txt         # chunk text (512 tokens)
│   ├── 0002.emb
│   ├── 0002.txt
│   └── ...
└── cover.png            # optional cover image
```

**Packs are loaded** by extracting to a `packs/` directory and registering in the SQLite database. No on-device processing needed.

### 5.2 User Library

Users can add PDFs, EPUBs, markdown files, and web articles:

1. File imported → text extracted (Rust: `pdf-extract`, `epub` crates)
2. Text chunked (512 tokens, 64 overlap)
3. Embeddings computed (on-device, via the always-resident embedding model)
4. Stored in SQLite `embeddings` table with `source_type='library_chunk'`

### 5.3 Search Flow

```
User: "What does Hormozi say about grand slam offers?"
    │
    ├── search_library("grand slam offers", pack_ids=["copywriting-masters"])
    │   → Returns top-3 chunks from Hormozi's section
    │
    ├── search_notes("grand slam offers")
    │   → Returns 0 (user hasn't noted on this)
    │
    └── Context assembled with both results
    → "Based on Alex Hormozi's '100M Offers', the Grand Slam Offer is..."
```

---

## 6. Knowledge Tree (Steal Like an Artist)

A directed graph of influences that grounds the AI's responses in the user's chosen intellectual lineage.

### 6.1 Structure

```
Table: knowledge_tree_nodes
  id TEXT PRIMARY KEY,
  user_id TEXT,
  person_name TEXT,
  field TEXT,              -- "copywriting", "product", "strategy", etc.
  level INTEGER,           -- 1 (direct mentor) to 5
  biography TEXT,
  key_works JSON,         -- [{title, year, type}]
  source_type TEXT,       -- 'user_picked' | 'ai_suggested' | 'user_added'
  created_at TEXT

Table: knowledge_tree_edges
  id TEXT PRIMARY KEY,
  from_id TEXT REFERENCES knowledge_tree_nodes,
  to_id TEXT REFERENCES knowledge_tree_nodes,
  relationship TEXT,       -- 'mentored_by', 'influenced_by', 'studied_under'
  confidence REAL,        -- 0.0 to 1.0
  source TEXT             -- 'user_defined' | 'ai_inferred'
```

### 6.2 Level Structure

```
Level 1: User's 3 mentors (hand-picked)
Level 2: Their 3 biggest influences each (AI-suggested, user-approved)
Level 3: Their influences (AI-discovered)
Level 4: Further back (AI-discovered)
Level 5: Foundational thinkers (AI-discovered, rarely user-visible)
```

Total: up to 3 × 3 × 3 × 3 × 3 = 243 people. In practice, many converge (everyone traces back to Drucker or Socrates).

### 6.3 Influence Inference

For AI-suggested influences, the model uses its training knowledge of intellectual history. No external API needed. Confidence scores indicate reliability:

- >0.9: Widely known and documented influence (e.g., "Ogilvy was influenced by Hopkins")
- 0.7-0.9: Plausible and cited in biographies
- 0.5-0.7: Inferred from intellectual lineage
- <0.5: Not shown to user unless explicitly exploring

### 6.4 Query Enhancement

When a user asks a domain-related question, the knowledge tree injects relevant lineage context:

```
User: "Help me write a better headline"

Without tree: "Use strong verbs, be specific, test variations..."
With tree: "Your lineage traces Ogilvy → Hopkins → Kennedy → Lasker.
Here's how Ogilvy's 'big idea' principle and Hopkins' 'specific
benefit' rule combine in headline writing..."
```

---

## 7. Life Audit (RAG-Enhanced)

The Life Audit uses the full RAG pipeline to evaluate project alignment with the user's visions.

### 7.1 Algorithm

```
For each project:
  1. Embed project title + description + milestone titles
  2. Search all vision texts for semantic similarity
     → Alignment Score = max(cosine_similarity) [weight: 0.50]
  3. Calculate task completion rate
     → Progress Score = done_tasks / total_tasks [weight: 0.30]
  4. Measure recency of activity
     → Activity Score = tasks updated in last 7d / total_tasks [weight: 0.20]
  5. Final = 0.50 × alignment + 0.30 × progress + 0.20 × activity
```

### 7.2 Classification

| Score | Classification | Description |
|---|---|---|
| >0.75 | Essential | Highly aligned with vision, making progress |
| 0.50-0.75 | Supporting | Connected but not critical |
| 0.25-0.50 | Low Priority | Weak alignment, stalled |
| <0.25 | Distraction | Not connected to vision, no progress |

---

## 8. Web Search (Permission-Gated)

The AI can optionally search the web for current information. This is controlled by a user setting:

| Setting | Behavior |
|---|---|
| Always | Searches automatically when query requires current info |
| Ask (default) | Shows dialog: "Search the web for this?" |
| Never | AI responds: "I can't access the internet. Here's what I know from my training data..." |

**Privacy**: Web search queries are sent from the device. No user identity or app data is included in the query. Users are warned before the first search.

---

## 9. Browser Implementation (Current)

Until the Tauri backend with llama.cpp is compiled, the AI runs in **deterministic mode** with these capabilities:

| Feature | Status | Notes |
|---|---|---|
| Intent classifier | ✅ Heuristic (pattern matching) | Will be replaced by 0.5B model |
| Multi-source RAG | ✅ Full implementation | Notes + Library + Tree + Entities |
| Template responses | ✅ Rich, contextual | Feels intelligent due to deep data integration |
| Tool execution | ✅ Full CRUD | Same interface as real LLM will use |
| Library packs | ✅ Local file-based | `.raivapack` format |
| Knowledge tree | ✅ Full graph | Influence discovery via heuristic |
| Life audit | ✅ RAG-enhanced | Uses full pipeline |
| Web search | ⚠️ Placeholder | Requires permission UI + search API integration |
| Real LLM inference | ❌ | Requires Tauri desktop build with llama.cpp |

### 9.1 Deterministic Mode Architecture

```
┌──────────────────────────────┐
│          Query                │
│                              │
│  Step 1: Classify intent     │
│  ┌────────────────────────┐  │
│  │ keywords + patterns →  │  │
│  │ intent label            │  │
│  └────────────────────────┘  │
│                              │
│  Step 2: Gather context      │
│  ┌────────────────────────┐  │
│  │ Notes RAG              │  │
│  │ Library RAG            │  │
│  │ Knowledge Tree         │  │
│  │ App entities           │  │
│  └────────────────────────┘  │
│                              │
│  Step 3: Response generation │
│  ┌────────────────────────┐  │
│  │ Template selector →    │  │
│  │ context interpolation  │  │
│  │ → rich response        │  │
│  └────────────────────────┘  │
│                              │
│  Step 4: Tool execution     │
│  ┌────────────────────────┐  │
│  │ Parse commands →       │  │
│  │ execute → report       │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

---

## 10. Cross-Platform Deployment

| Platform | Runtime | Model Backend | Default Tier | Min RAM |
|---|---|---|---|---|
| Windows (x86_64) | Tauri + libllama | llama.cpp | Standard (auto-detect) | 4GB |
| macOS (ARM + Intel) | Tauri + libllama | llama.cpp (Metal) | Standard | 4GB |
| Linux (x86_64, ARM64) | Tauri + libllama | llama.cpp (Vulkan) | Standard | 4GB |
| iOS (ARM64) | Tauri mobile + libllama | llama.cpp (Metal) | Micro | 4GB |
| Android (ARM64) | Tauri mobile + libllama | llama.cpp (Vulkan) | Micro | 4GB |
| ChromeBook | Android APK / Linux | llama.cpp | Micro | 4GB |

---

## 11. Business Model

| Tier | Price | Features |
|---|---|---|
| Free | $0 | AI template mode + Micro model optional. Full app features. No cloud. |
| Standard | One-time $9.99 | Unlock 3B/7B model. Up to 5 library packs. |
| Pro | $4.99/mo or $49/yr | All models. Unlimited packs. Cloud vector DB. Multi-device sync. |
| Pro+ | $9.99/mo | + Server-side 70B inference. Web search. Priority updates. |
| Enterprise | Custom | On-prem deployment. Self-hosted model. Team management. White-label. |

---

## 12. Robotics Bridge (Future)

The same architecture powers a physical robot with zero code changes to the core:

| Component | GUI App | Physical Robot |
|---|---|---|
| Input | Keyboard + mouse | Whisper speech + Vision camera |
| Brain | MoE/RAG/cascade | MoE/RAG/cascade (identical) |
| Memory | SQLite + embeddings | SQLite + embeddings + spatial memory |
| Output | Screen + speakers | TTS + motor control |
| Tools | CRUD app entities | CRUD + `move_to`, `pick_up`, `greet` |
| RAG | Notes + Library | + Environment logs, object database |

The same installer, the same models, the same data format. The robot is a new UI layer on the same cognitive architecture.

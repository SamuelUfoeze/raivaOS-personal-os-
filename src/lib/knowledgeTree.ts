export interface TreeNode {
  id: string;
  personName: string;
  field: string;
  level: number;
  bio: string;
  keyWorks: { title: string; year: number; type: string }[];
  sourceType: "user_picked" | "ai_suggested" | "user_added";
}

export interface TreeEdge {
  id: string;
  fromId: string;
  toId: string;
  relationship: "mentored_by" | "influenced_by" | "studied_under";
  confidence: number;
  source: "user_defined" | "ai_inferred";
}

const NODES_KEY = "raiva_tree_nodes";
const EDGES_KEY = "raiva_tree_edges";

function loadNodes(): TreeNode[] {
  try { return JSON.parse(localStorage.getItem(NODES_KEY) || "[]"); }
  catch { return []; }
}
function saveNodes(n: TreeNode[]) { localStorage.setItem(NODES_KEY, JSON.stringify(n)); }

function loadEdges(): TreeEdge[] {
  try { return JSON.parse(localStorage.getItem(EDGES_KEY) || "[]"); }
  catch { return []; }
}
function saveEdges(e: TreeEdge[]) { localStorage.setItem(EDGES_KEY, JSON.stringify(e)); }

let idCounter = Date.now();
function genId() { return `tn_${idCounter++}`; }

export const knowledgeTree = {

  getNodes(): TreeNode[] { return loadNodes(); },
  getEdges(): TreeEdge[] { return loadEdges(); },

  addNode(person: Omit<TreeNode, "id" | "sourceType"> & { sourceType?: string }): TreeNode {
    const nodes = loadNodes();
    const node: TreeNode = {
      ...person,
      id: genId(),
      sourceType: (person.sourceType as any) || "user_added",
    };
    nodes.push(node);
    saveNodes(nodes);
    return node;
  },

  addEdge(fromId: string, toId: string, rel: TreeEdge["relationship"], conf = 1, src: TreeEdge["source"] = "user_defined"): TreeEdge {
    const edges = loadEdges();
    const edge: TreeEdge = {
      id: genId(),
      fromId, toId, relationship: rel, confidence: conf, source: src,
    };
    edges.push(edge);
    saveEdges(edges);
    return edge;
  },

  removeNode(id: string): void {
    saveNodes(loadNodes().filter((n) => n.id !== id));
    saveEdges(loadEdges().filter((e) => e.fromId !== id && e.toId !== id));
  },

  removeEdge(id: string): void {
    saveEdges(loadEdges().filter((e) => e.id !== id));
  },

  getTreeForDomain(field: string): { nodes: TreeNode[]; edges: TreeEdge[] } {
    const nodes = loadNodes().filter((n) => n.field === field);
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = loadEdges().filter((e) => nodeIds.has(e.fromId) && nodeIds.has(e.toId));
    return { nodes, edges };
  },

  getAncestors(nodeId: string): TreeNode[] {
    const edges = loadEdges();
    const nodes = loadNodes();
    const result: TreeNode[] = [];
    const visited = new Set<string>();
    function walk(id: string) {
      const parentEdges = edges.filter((e) => e.toId === id && e.relationship === "mentored_by");
      for (const pe of parentEdges) {
        if (visited.has(pe.fromId)) continue;
        visited.add(pe.fromId);
        const parent = nodes.find((n) => n.id === pe.fromId);
        if (parent) { result.push(parent); walk(parent.id); }
      }
    }
    walk(nodeId);
    return result;
  },

  getLineageContext(query: string): string {
    const field = detectField(query);
    const { nodes, edges } = knowledgeTree.getTreeForDomain(field);
    if (nodes.length === 0) return "";

    const topLevel = nodes.filter((n) => n.level === 1);
    let ctx = `\n--- YOUR KNOWLEDGE TREE (${field}) ---\n`;
    ctx += `Selected mentors in this domain:\n`;
    for (const n of topLevel) {
      const ancestors = knowledgeTree.getAncestors(n.id);
      const lineage = ancestors.length > 0
        ? ` ← ${ancestors.map((a) => a.personName).join(" ← ")}`
        : "";
      ctx += `• ${n.personName}${lineage}\n`;
    }
    if (topLevel.length === 0) {
      ctx += nodes.map((n) => `• ${n.personName} (level ${n.level})`).join("\n");
    }
    return ctx;
  },
};

const FIELD_KEYWORDS: Record<string, string[]> = {
  copywriting: ["copy", "write", "headline", "sales", "advertise", "offer", "marketing", "persuade", "convert"],
  product: ["product", "feature", "user", "customer", "build", "ship", "roadmap", "mvp", "pm"],
  strategy: ["strategy", "plan", "compete", "market", "grow", "scale", "lead", "manage", "organization"],
  writing: ["writing", "story", "edit", "publish", "creative", "article", "book", "essay"],
  design: ["design", "ui", "ux", "visual", "typography", "layout", "interface"],
  leadership: ["lead", "team", "culture", "vision", "mission", "people", "manage", "coach", "mentor"],
};

function detectField(query: string): string {
  const lower = query.toLowerCase();
  let bestField = "general";
  let bestScore = 0;
  for (const [field, keywords] of Object.entries(FIELD_KEYWORDS)) {
    const score = keywords.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; bestField = field; }
  }
  return bestField;
}

export function getStarterMentors() {
  return [
    {
      personName: "David Ogilvy",
      field: "copywriting",
      bio: "Father of modern advertising. Known for big ideas, direct response, and research-driven creative.",
      keyWorks: [{ title: "Ogilvy on Advertising", year: 1983, type: "book" }],
    },
    {
      personName: "Alex Hormozi",
      field: "copywriting",
      bio: "Modern direct-response marketer. Author of 100M Offers and 100M Leads.",
      keyWorks: [{ title: "100M Offers", year: 2021, type: "book" }],
    },
    {
      personName: "Marty Cagan",
      field: "product",
      bio: "Product management thought leader. Author of Inspired and Empowered.",
      keyWorks: [{ title: "Inspired", year: 2008, type: "book" }],
    },
    {
      personName: "Jim Collins",
      field: "strategy",
      bio: "Business strategist and author of Good to Great, Built to Last, and Great by Choice.",
      keyWorks: [{ title: "Good to Great", year: 2001, type: "book" }],
    },
    {
      personName: "Sun Tzu",
      field: "strategy",
      bio: "Ancient Chinese military strategist. Author of The Art of War.",
      keyWorks: [{ title: "The Art of War", year: -500, type: "book" }],
    },
    {
      personName: "William Zinsser",
      field: "writing",
      bio: "Writing teacher and author of On Writing Well. Champion of clarity and simplicity.",
      keyWorks: [{ title: "On Writing Well", year: 1976, type: "book" }],
    },
  ];
}

export function getInfluences(personName: string): { name: string; relation: string; confidence: number }[] {
  const influences: Record<string, { name: string; relation: string; confidence: number }[]> = {
    "David Ogilvy": [
      { name: "Claude Hopkins", relation: "Studied his methods", confidence: 0.95 },
      { name: "Raymond Rubicam", relation: "Worked under at Young & Rubicam", confidence: 0.85 },
      { name: "John Caples", relation: "Influenced by his direct response work", confidence: 0.8 },
    ],
    "Claude Hopkins": [
      { name: "Albert Lasker", relation: "Worked with at Lord & Thomas", confidence: 0.9 },
      { name: "John E. Kennedy", relation: "Studied his 'reason why' approach", confidence: 0.85 },
    ],
    "Alex Hormozi": [
      { name: "David Ogilvy", relation: "Influenced by his advertising principles", confidence: 0.8 },
      { name: "Claude Hopkins", relation: "Direct response lineage", confidence: 0.75 },
    ],
    "Marty Cagan": [
      { name: "Peter Drucker", relation: "Management principles", confidence: 0.7 },
      { name: "Steve Blank", relation: "Customer development methodology", confidence: 0.85 },
    ],
    "Jim Collins": [
      { name: "Peter Drucker", relation: "Management philosophy foundation", confidence: 0.9 },
      { name: "John C. Gardner", relation: "Mentor and Stanford professor", confidence: 0.8 },
    ],
    "Sun Tzu": [
      { name: "Jiang Ziya", relation: "Earlier Chinese strategist", confidence: 0.5 },
    ],
    "William Zinsser": [
      { name: "E.B. White", relation: "Influenced by Elements of Style", confidence: 0.85 },
      { name: "Strunk", relation: "Elements of Style co-author", confidence: 0.9 },
    ],
    "Peter Drucker": [
      { name: "Mary Parker Follett", relation: "Early management thinker", confidence: 0.7 },
      { name: "Joseph Schumpeter", relation: "Innovation theory", confidence: 0.65 },
    ],
    "John Caples": [
      { name: "Claude Hopkins", relation: "Direct response pioneer", confidence: 0.85 },
    ],
    "Raymond Rubicam": [
      { name: "Claude Hopkins", relation: "Influenced by his approach", confidence: 0.75 },
    ],
    "E.B. White": [
      { name: "Strunk", relation: "Teacher and co-author", confidence: 0.95 },
    ],
    "Steve Blank": [
      { name: "John Boyd", relation: "OODA loop framework influence", confidence: 0.6 },
    ],
  };
  return influences[personName] || [];
}

export function getTreeContext(query: string): string {
  return knowledgeTree.getLineageContext(query);
}

export function enrichWithMentorContext(field: string, nodes: TreeNode[], edges: TreeEdge[]): string {
  const level1 = nodes.filter((n) => n.level === 1);
  if (level1.length === 0) return "";

  let ctx = `Your thinking is shaped by ${level1.map((n) => n.personName).join(", ")}`;
  const heritage = level1.map((n) => {
    const ancestors = edges
      .filter((e) => e.toId === n.id && e.relationship === "mentored_by")
      .map((e) => nodes.find((nd) => nd.id === e.fromId))
      .filter(Boolean)
      .map((nd) => nd!.personName);
    if (ancestors.length > 0) return `${n.personName} ← ${ancestors.join(" ← ")}`;
    return n.personName;
  });
  return `${ctx}:\n${heritage.map((h) => `• ${h}`).join("\n")}\n`;
}

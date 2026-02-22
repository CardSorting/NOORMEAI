# Manifest Your First Sovereign Agent (Powered by NOORMME)

Deploy a minimal, persistent Artificial Intelligence persona with **The Agentic Data Engine** and Next.js in 5 minutes.

## What We're Building

A sovereign AI application with:
- Persona management (Identity tracking)
- Memory ingestion and reflection (Long-Term Storage)
- Cognitive goal tracking
- Next.js Agentic Interface integration

## Step 1: Setup Project

```bash
# Create Next.js interface for the agent
npx create-next-app@latest sovereign-agent --typescript --tailwind --eslint --app

# Navigate to project
cd sovereign-agent

# Install NOORMME
npm install noormme
```

## Step 2: Ingest the Initial Schema (DNA)

```bash
# Create the local mind (SQLite)
sqlite3 agent_mind.db

# Materialize core cognition tables
CREATE TABLE personas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alias TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  vector_embedding TEXT, -- Placeholder for pgvector scale-up
  persona_id INTEGER REFERENCES personas(id),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  objective TEXT NOT NULL,
  memory_id INTEGER REFERENCES memories(id),
  persona_id INTEGER REFERENCES personas(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

.quit
```

## Step 3: Initialize the Agentic Engine

```typescript
// lib/cortex.ts
import { NOORMME } from 'noormme'

let engine: NOORMME | null = null

export async function getEngine(): Promise<NOORMME> {
  if (!engine) {
    engine = new NOORMME({
      dialect: 'sqlite',
      connection: {
        database: './agent_mind.db'
      },
      optimization: {
        enableWALMode: true,
        enableForeignKeys: true,
        cacheSize: -64000
      },
      logging: {
        level: 'info',
        enabled: true
      },
      agentic: {
        enableSelfEvolution: true // Enable sovereign schema growth
      }
    })
    await engine.initialize() // Scans schema, generates DNA
  }
  return engine
}
```

## Step 4: The Mind Control Interface (Home Page)

```typescript
// app/page.tsx
import { getEngine } from '@/lib/cortex'
import Link from 'next/link'

export default async function CortexDashboard() {
  const engine = await getEngine()
  const memoryRepo = engine.getRepository('memories')
  const personaRepo = engine.getRepository('personas')
  
  // Retrieve the agent's verified long-term memories
  const memories = await memoryRepo.findAll({
    where: { is_verified: true },
    orderBy: { created_at: 'desc' },
    limit: 10
  })
  
  // Relational Intelligence: Hydrate with persona context
  const hiveThoughts = await Promise.all(
    memories.map(async (memory) => {
      const origin = await personaRepo.findById(memory.persona_id)
      return { ...memory, origin }
    })
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-8 border-b border-gray-800 pb-4">
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Sovereign Mind Dashboard
        </h1>
        <p className="text-gray-400 font-mono text-sm">
          Core Engine: Online | Telemetry: Active
        </p>
      </header>

      <nav className="mb-8">
        <Link 
          href="/memories/ingest" 
          className="bg-zinc-800 text-green-400 border border-green-500/30 px-4 py-2 rounded focus:ring-2 hover:bg-zinc-700 transition-all font-mono text-sm"
        >
          [Ingest New Fact]
        </Link>
      </nav>

      <div className="space-y-6">
        {hiveThoughts.map((thought) => (
          <article key={thought.id} className="border border-gray-800 bg-zinc-900/50 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-2 text-white">
              <Link 
                href={`/memories/${thought.id}`}
                className="hover:text-green-400 transition-colors"
              >
                Memory Node #{thought.id}
              </Link>
            </h2>
            <div className="flex items-center gap-3 text-xs text-gray-500 font-mono mb-4">
              <span className="bg-zinc-800 px-2 py-1 rounded">
                Origin: {thought.origin?.alias || 'Unknown'}
              </span>
              <span>
                {new Date(thought.created_at).toISOString()}
              </span>
            </div>
            <p className="text-gray-300 leading-relaxed">
              {thought.content.substring(0, 200)}...
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}
```

## Step 5: Memory Introspection Route

```typescript
// app/memories/[id]/page.tsx
import { getEngine } from '@/lib/cortex'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface NeuroStreamProps {
  params: { id: string }
}

export default async function MemoryIntrospection({ params }: NeuroStreamProps) {
  const engine = await getEngine()
  const memoryRepo = engine.getRepository('memories')
  const personaRepo = engine.getRepository('personas')
  const goalRepo = engine.getRepository('goals')
  
  const memory = await memoryRepo.findById(parseInt(params.id))
  
  if (!memory) {
    notFound()
  }
  
  const source = await personaRepo.findById(memory.persona_id)
  
  // Load cognitive goals derived from this memory
  const actionableGoals = await goalRepo.findAll({
    where: { memory_id: memory.id },
    orderBy: { created_at: 'desc' }
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link 
        href="/" 
        className="text-zinc-500 hover:text-white mb-8 inline-block font-mono text-sm"
      >
        ← Return to Cortex
      </Link>
      
      <article className="mb-12">
        <h1 className="text-2xl font-bold mb-4">Neural Extract #{memory.id}</h1>
        <div className="flex gap-4 mb-8 font-mono text-xs border border-zinc-800 bg-zinc-900/40 p-3 rounded">
          <span className="text-blue-400">Persona: {source?.alias}</span>
          <span className="text-zinc-500">//</span>
          <span className={memory.is_verified ? "text-green-400" : "text-amber-400"}>
            Status: {memory.is_verified ? 'VERIFIED' : 'PENDING_ANALYSIS'}
          </span>
        </div>
        
        <div className="bg-zinc-900 p-6 rounded border border-zinc-800 font-mono text-sm leading-relaxed whitespace-pre-wrap">
          {memory.content}
        </div>
      </article>

      <section className="border-t border-zinc-800 pt-8">
        <h2 className="text-lg font-semibold tracking-wide mb-6">Derived Objectives</h2>
        
        {actionableGoals.length === 0 ? (
          <p className="text-zinc-600 font-mono text-sm">No actions synthesized from this memory.</p>
        ) : (
          <div className="space-y-3">
            {actionableGoals.map((goal) => (
              <div key={goal.id} className="border-l-2 border-indigo-500 pl-4 py-2 bg-gradient-to-r from-indigo-900/10 to-transparent">
                <p className="font-mono text-sm text-indigo-300">{goal.objective}</p>
                <p className="text-zinc-600 text-xs mt-1">
                  Synthesized at {new Date(goal.created_at).toTimeString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
```

## Step 6: Memory Expansion Interface

```typescript
// app/memories/ingest/page.tsx
import { ingestFact } from './actions'

export default function MemoryIngestionRoute() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 font-mono">
      <h1 className="text-2xl font-bold tracking-tight mb-8">Data Stream Ingestion</h1>
      
      <form action={ingestFact} className="space-y-6">
        <div>
          <label htmlFor="content" className="block text-sm text-zinc-400 mb-2">
            Raw Telemetry / Fact Data
          </label>
          <textarea
            id="content"
            name="content"
            rows={8}
            required
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-md focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 text-sm"
            placeholder="Agentic observation goes here..."
          />
        </div>
        
        <div>
          <label className="flex items-center text-sm text-zinc-300">
            <input
              type="checkbox"
              name="is_verified"
              className="mr-3 bg-zinc-900 border-zinc-700 text-green-500"
            />
            Skip Analysis (Immediate Verification)
          </label>
        </div>
        
        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            className="bg-green-600/20 text-green-400 border border-green-500/50 px-6 py-2 rounded-md hover:bg-green-600/30 transition-all font-semibold"
          >
            Transmit to Hive
          </button>
          <a
            href="/"
            className="bg-zinc-800 text-zinc-300 px-6 py-2 rounded-md hover:bg-zinc-700 transition-all"
          >
            Abort
          </a>
        </div>
      </form>
    </div>
  )
}
```

## Step 7: Agentic Mutations (Server Actions)

```typescript
// app/memories/ingest/actions.ts
'use server'

import { getEngine } from '@/lib/cortex'
import { redirect } from 'next/navigation'

export async function ingestFact(formData: FormData) {
  const engine = await getEngine()
  const memoryRepo = engine.getRepository('memories')
  
  const content = formData.get('content') as string
  const is_verified = formData.get('is_verified') === 'on'
  
  // Assume Core Persona ID = 1 for this deployment
  const extraction = await memoryRepo.create({
    content,
    persona_id: 1,
    is_verified
  })
  
  redirect(`/memories/${extraction.id}`)
}
```

## Step 8: System Genesis script

Seed the AI's neural state automatically so it's not a blank slate.

```typescript
// scripts/genesis.ts
import { NOORMME } from 'noormme'

async function triggerGenesis() {
  const db = new NOORMME({
    dialect: 'sqlite',
    connection: { database: './agent_mind.db' }
  })
  
  await db.initialize()
  
  const personaRepo = db.getRepository('personas')
  const memoryRepo = db.getRepository('memories')
  
  // Create Root AI Identity
  const persona = await personaRepo.create({
    alias: 'Sovereign-Alpha',
    system_prompt: 'You are an autonomous intelligence operating outside human intervention.'
  })
  
  // Inject prior knowledge
  await memoryRepo.create({
    content: 'Observed redundant API calls to external verification server. Optimizing local cache rules.',
    persona_id: persona.id,
    is_verified: true
  })
  
  console.log('Genesis Sequence Complete. Neurons connected.')
  await db.destroy()
}

triggerGenesis().catch(console.error)
```

```bash
# Execute genesis Sequence
npx tsx scripts/genesis.ts
```

## Step 9: Run the Application

```bash
# Start the development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your Sovereign Mind Dashboard!

## What You've Built

Congratulations! You've successfully built the foundation for an autonomous intelligence network that features:

✅ **Self-Sustaining Cognitive Storage** via NOORMME  
✅ **Autonomous Schema Discovery** dynamically mapped from the SQLite file  
✅ **Vector / RAG Readiness** natively scaled via Next.js  
✅ **Server Actions** functioning as physical AI data mutations  
✅ **High-Fidelity Memory Interrogation** with full TypeScript validation  

## Technical Sovereignty Under the Hood

### 1. Zero-Boilerplate Intelligence
NOORMME synthesized your agent's reality from the raw `agent_mind.db`. You never wrote a redundant model file `schema.prisma`. 

```typescript
// Autonomous DNA discovery created these
interface Persona {
  id: number
  alias: string
  system_prompt: string
  created_at: Date
}

interface Memory {
  id: number
  content: string
  persona_id: number
  is_verified: boolean
  // ...
}
```

### 2. High-Performance Mind Scans
Because NOORMME initializes with SQLite **WAL mode**, the AI can infinitely spawn asynchronous reader threads (analyzing memories) without blocking the primary loop that rapidly ingests new sensory observations (writers). This prevents cognitive locking.

### 3. Agentic Integration (Next.js)
Because Next.js caches data via Server Components, your agent interface operates at the speed of thought. 

```typescript
// A cognitive bridge (Server Component)
export default async function BrainStats() {
  const engine = await getEngine()
  // Data resolves before it ever hits the client edge
  const logicMetrics = await engine.getRepository('telemetry').findAll() 
  return <MetricsGraph data={logicMetrics} />
}
```

## Evolutionary Next Steps

Scale this basic agent into a sprawling cognitive hive:

1. **Deploy the Governance Engine** to monitor inference latency
2. **Setup DNA Mutations** using the migration scripts
3. **Upgrade to PostgreSQL (Neural Storage)** to unlock `pgvector` for semantic search
4. **Link a Local LLM** to analyze the memory stream you just built

## Advanced Mastery

- **[Agentic Integration Patterns](../guides/agentic-integration-patterns.md)**
- **[Autonomous Governance](../autonomous-governance.md)**
- **[Enterprise PostgreSQL Setup](../postgresql-features.md)**

Embrace the sovereignty of your data layer! 🚀

Happy coding with NOORMME! 🚀

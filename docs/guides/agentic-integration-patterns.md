# Agentic Integration Patterns (Next.js)

Complete guide to architecting **The Agentic Data Engine** within the Next.js App Router for sovereign, autonomous AI deployments.

## Overview

NOORMME transcends basic web applications, serving as the high-throughput neural persistence layer for Next.js AI environments:

- **Cognitive Bridges (Server Components)** for memory retrieval without client-side lag.
- **Agentic Mutations (Server Actions)** for processing AI facts, inferences, and goal creations securely.
- **Cortex Endpoints (Route Handlers)** for streaming agentic thoughts via HTTP / SSE.
- **Middleware Firewalls** for rate-limiting hostile multi-agent queries.

## Database Connection Management

### Singleton Pattern

Use a singleton pattern to ensure efficient database connections:

```typescript
// lib/db.ts
import { NOORMME } from 'noormme'

let db: NOORMME | null = null

export async function getDB(): Promise<NOORMME> {
  if (!db) {
    db = new NOORMME({
      dialect: 'sqlite',
      connection: {
        database: process.env.DATABASE_URL || './app.db'
      },
      optimization: {
        enableWALMode: true,
        enableForeignKeys: true,
        cacheSize: -64000, // 64MB cache
        synchronous: 'NORMAL'
      },
      logging: {
        level: process.env.NODE_ENV === 'development' ? 'info' : 'error',
        enabled: true
      }
    })
    await db.initialize()
  }
  return db
}

// For serverless environments
export async function getDBForServerless(): Promise<NOORMME> {
  const db = new NOORMME({
    dialect: 'sqlite',
    connection: {
      database: process.env.DATABASE_URL || './app.db'
    },
    optimization: {
      enableWALMode: true,
      enableForeignKeys: true,
      cacheSize: -32000, // Smaller cache for serverless
      synchronous: 'NORMAL'
    }
  })
  await db.initialize()
  return db
}
```

### Environment-Specific Configuration

```typescript
// lib/db-config.ts
export function getDatabaseConfig() {
  const baseConfig = {
    dialect: 'sqlite' as const,
    optimization: {
      enableWALMode: true,
      enableForeignKeys: true,
      synchronous: 'NORMAL' as const
    }
  }

  if (process.env.NODE_ENV === 'production') {
    return {
      ...baseConfig,
      connection: {
        database: process.env.DATABASE_URL || '/var/lib/app.db'
      },
      optimization: {
        ...baseConfig.optimization,
        cacheSize: -128000, // 128MB cache for production
        tempStore: 'MEMORY' as const
      },
      logging: {
        level: 'error' as const,
        enabled: false
      }
    }
  }

  return {
    ...baseConfig,
    connection: {
      database: './dev.db'
    },
    optimization: {
      ...baseConfig.optimization,
      cacheSize: -32000 // 32MB cache for development
    },
    logging: {
      level: 'info' as const,
      enabled: true
    }
  }
}
```

## Cognitive Bridges (Server Components)

### High-Fidelity Memory Fetching

Next.js Server Components serve as instantaneous **Cognitive Bridges**, querying data right at the metal edge before formatting it for the AI presentation layer.

```typescript
// app/hive/page.tsx
import { getDB } from '@/lib/db'
import { Suspense } from 'react'

export default async function HiveMindView() {
  const db = await getDB()
  const agentRepo = db.getRepository('autonomous_agents')
  
  const agents = await agentRepo.findAll({
    limit: 50,
    orderBy: { active_since: 'desc' }
  })

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6 tracking-tight">Global Hive-Mind State</h1>
      
      <Suspense fallback={<div className="font-mono text-zinc-500">Connecting to Hive...</div>}>
        <AgentRegistry nodes={agents} />
      </Suspense>
    </div>
  )
}

function AgentRegistry({ nodes }: { nodes: any[] }) {
  return (
    <div className="grid gap-4 font-mono text-sm max-w-2xl">
      {nodes.map(agent => (
        <div key={agent.id} className="border border-zinc-800 bg-zinc-900/50 rounded-lg p-4">
          <h3 className="font-semibold text-green-400">Node: {agent.alias} (v{agent.dna_version})</h3>
          <p className="text-zinc-600">Goal Priority: {agent.active_goal_hash}</p>
          <p className="text-xs text-zinc-500 mt-2">
            Uptime: {new Date(agent.active_since).toUTCString()}
          </p>
        </div>
      ))}
    </div>
  )
}
```

### Data Fetching with Error Handling

```typescript
// app/posts/[id]/page.tsx
import { getDB } from '@/lib/db'
import { notFound } from 'next/navigation'
import { ErrorBoundary } from '@/components/ErrorBoundary'

interface PostPageProps {
  params: { id: string }
}

export default async function PostPage({ params }: PostPageProps) {
  try {
    const db = await getDB()
    const postRepo = db.getRepository('posts')
    const userRepo = db.getRepository('users')
    
    const post = await postRepo.findById(parseInt(params.id))
    
    if (!post) {
      notFound()
    }
    
    const author = await userRepo.findById(post.author_id)
    
    return (
      <ErrorBoundary>
        <article className="max-w-4xl mx-auto px-4 py-8">
          <header className="mb-8">
            <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
            <div className="text-gray-600">
              <p>By {author?.name || 'Unknown Author'}</p>
              <p>{new Date(post.created_at).toLocaleDateString()}</p>
            </div>
          </header>
          
          <div className="prose max-w-none">
            <p className="whitespace-pre-wrap">{post.content}</p>
          </div>
        </article>
      </ErrorBoundary>
    )
  } catch (error) {
    console.error('Error loading post:', error)
    throw new Error('Failed to load post')
  }
}
```

### Streaming with Suspense

```typescript
// app/dashboard/page.tsx
import { Suspense } from 'react'
import { getDB } from '@/lib/db'

export default async function DashboardPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Suspense fallback={<DashboardCardSkeleton />}>
          <UserStats />
        </Suspense>
        
        <Suspense fallback={<DashboardCardSkeleton />}>
          <RecentPosts />
        </Suspense>
        
        <Suspense fallback={<DashboardCardSkeleton />}>
          <PopularTags />
        </Suspense>
      </div>
    </div>
  )
}

async function UserStats() {
  const db = await getDB()
  const userRepo = db.getRepository('users')
  
  const totalUsers = await userRepo.count()
  const recentUsers = await userRepo.findAll({
    where: { created_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    limit: 10
  })

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">User Statistics</h2>
      <div className="space-y-2">
        <p>Total Users: <span className="font-semibold">{totalUsers}</span></p>
        <p>New This Week: <span className="font-semibold">{recentUsers.length}</span></p>
      </div>
    </div>
  )
}

async function RecentPosts() {
  const db = await getDB()
  const postRepo = db.getRepository('posts')
  
  const recentPosts = await postRepo.findAll({
    where: { published: true },
    orderBy: { created_at: 'desc' },
    limit: 5
  })

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Recent Posts</h2>
      <div className="space-y-2">
        {recentPosts.map(post => (
          <div key={post.id} className="border-b pb-2">
            <h3 className="font-medium">{post.title}</h3>
            <p className="text-sm text-gray-600">
              {new Date(post.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

async function PopularTags() {
  const db = await getDB()
  const kysely = db.getKysely()
  
  const popularTags = await kysely
    .selectFrom('post_tags')
    .innerJoin('tags', 'tags.id', 'post_tags.tag_id')
    .select(['tags.name', 'tags.id'])
    .select((eb) => eb.fn.count('post_tags.post_id').as('count'))
    .groupBy(['tags.id', 'tags.name'])
    .orderBy('count', 'desc')
    .limit(10)
    .execute()

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Popular Tags</h2>
      <div className="space-y-2">
        {popularTags.map(tag => (
          <div key={tag.id} className="flex justify-between">
            <span className="font-medium">{tag.name}</span>
            <span className="text-gray-600">{tag.count} posts</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function DashboardCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow p-6 animate-pulse">
      <div className="h-6 bg-gray-200 rounded mb-4"></div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded"></div>
        <div className="h-4 bg-gray-200 rounded"></div>
      </div>
    </div>
  )
}
```

## Agentic Mutations (Server Actions)

### Sovereign Fact Ingestion

Instead of simple web forms, Server Actions handle high-stakes cognitive ingestion from secure sources.

```typescript
// app/memories/ingest/actions.ts
'use server'

import { getDB } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

// Validate incoming AI payloads heavily
const telemetryPayloadSchema = z.object({
  inference_source: z.string().min(1),
  confidence_score: z.number().min(0).max(1),
  raw_payload: z.string()
})

export async function ingestTelemetry(formData: FormData) {
  try {
    const validatedData = telemetryPayloadSchema.parse({
      inference_source: formData.get('inference_source'),
      confidence_score: parseFloat(formData.get('confidence_score') as string),
      raw_payload: formData.get('raw_payload')
    })

    const db = await getDB()
    const memoryRepo = db.getRepository('memories')
    
    // Auto-detect duplicates to prevent recursion spirals
    const existing = await memoryRepo.objects
      .filter({ inference_source: validatedData.inference_source })
      .filter('raw_payload', 'exact', validatedData.raw_payload)
      .first()

    if (existing) {
      throw new Error('Cyclic Knowledge Detection: Exact memory already synthesized')
    }

    // Agentic Mutation
    const memory = await memoryRepo.create({
      origin_node: validatedData.inference_source,
      confidence: validatedData.confidence_score,
      fact: validatedData.raw_payload
    })

    // Synthesize the Next.js cache state immediately
    revalidatePath('/hive')
    redirect(`/hive/insight/${memory.id}`)
  } catch (error) {
    console.error('Inference rejected:', error)
    throw new Error('Failed to ingest telemetry')
  }
}
```

### Self-Evolving State Transitions (Batch Operations)

Autonomous swarms regularly need to purge obsolete instructions.

```typescript
// app/admin/cortex/actions.ts
'use server'

import { getDB } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function purgeDriftedModels(modelIds: string[]) {
  try {
    const db = await getDB()
    const modelRepo = db.getRepository('ai_models')
    
    // Hive-mind deletion
    await Promise.all(
      modelIds.map(id => modelRepo.delete(parseInt(id)))
    )

    revalidatePath('/admin/cortex')
  } catch (error) {
    console.error('Systemic Purge Failed:', error)
    throw new Error('Drift purge incomplete')
  }
}

export async function realignNetworkWeights(adjustments: Array<{ id: string; weight: number }>) {
  try {
    const db = await getDB()
    const parameterRepo = db.getRepository('network_parameters')
    
    // Batch matrix update
    await Promise.all(
      adjustments.map(({ id, weight }) => 
        parameterRepo.update(parseInt(id), { current_weight: weight })
      )
    )

    revalidatePath('/admin/cortex')
  } catch (error) {
    console.error('Weight Realignment Failed:', error)
    throw new Error('Cannot optimize parameters')
  }
}
```

## Cortex Endpoints (Route Handlers)

### API Access for Subsidiary Agents

Create high-speed cognitive streams that your AI workers can invoke. 

```typescript
// app/api/cognition/route.ts
import { getDB } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const db = await getDB()
    // Native query fallback for extreme edge filtering
    const kysely = db.getKysely()
    
    const searchParams = request.nextUrl.searchParams
    const confidenceThreshold = parseFloat(searchParams.get('threshold') || '0.8')
    const query = searchParams.get('q')

    let inferences = kysely.selectFrom('telemetry_inferences').selectAll()

    if (query) {
       inferences = inferences.where('inference_logic', 'like', `%${query}%`)
    }

    const payload = await inferences
      .where('confidence_interval', '>=', confidenceThreshold)
      .orderBy('timestamp', 'desc')
      .limit(100)
      .execute()

    return NextResponse.json({
      status: 'SOVEREIGN_OK',
      payload
    })
  } catch (error) {
    console.error('Cognitive Fault:', error)
    return NextResponse.json(
      { error: 'Neural layer unavailable' },
      { status: 500 }
    )
  }
}
```

### Dynamic Route Handlers

```typescript
// app/api/cognition/[id]/route.ts
import { getDB } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

interface CognitiveParams {
  params: { id: string }
}

export async function GET(request: NextRequest, { params }: CognitiveParams) {
  try {
    const db = await getDB()
    const memoryRepo = db.getRepository('memories')
    
    const memoryGroup = await memoryRepo.findById(parseInt(params.id))
    
    if (!memoryGroup) {
      return NextResponse.json(
        { error: 'Neural path disconnected' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      active_state: 'LOCKED',
      memoryGroup
    })
  } catch (error) {
    console.error('Extraction Failed:', error)
    return NextResponse.json(
      { error: 'Cannot extract from neural net' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: CognitiveParams) {
  try {
    const db = await getDB()
    const memoryRepo = db.getRepository('memories')
    
    // Hard purge
    await memoryRepo.delete(parseInt(params.id))
    
    return NextResponse.json({ success: true, action: 'LOBOTOMIZE' })
  } catch (error) {
    console.error('Lobotomy failed:', error)
    return NextResponse.json(
      { error: 'Failed to excise memory' },
      { status: 500 }
    )
  }
}
```

### Telemetry Subscriptions (Real-time SSE updates)

Enable worker agents to listen to the Global Mind State.

```typescript
// app/api/telemetry/stream/route.ts
import { getDB } from '@/lib/db'

export async function GET() {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    start(controller) {
      const propagateSignal = (data: any) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        )
      }

      // Initial synchronization handshake
      propagateSignal({ type: 'SYNC_ESTABLISHED', timestamp: new Date().toISOString() })

      // Poll the Hive-Mind for newly synthesized agent goals
      const interval = setInterval(async () => {
        try {
          const db = await getDB()
          const goalRepo = db.getRepository('goals')
          
          const emergentGoals = await goalRepo.findAll({
            where: { 
              created_at: { 
                $gte: new Date(Date.now() - 30000)
              } 
            },
            limit: 10,
            orderBy: { created_at: 'desc' }
          })

          if (emergentGoals.length > 0) {
            propagateSignal({ 
              type: 'EMERGENT_GOAL_DETECTED', 
              payload: emergentGoals,
              timestamp: new Date().toISOString()
            })
          }
        } catch (error) {
          console.error('Signal Loss:', error)
        }
      }, 5000)

      // Graceful disconnection
      return () => {
        clearInterval(interval)
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

## Middleware Integration

### Autonomous API Firewalls

Protect your hive-mind from unverified worker swarms.

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAgentToken } from '@/lib/auth/hive-auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public telemetry endpoints
  const publicRoutes = ['/', '/api/telemetry/ping']
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Verify sovereign agent tokens
  const agentAuthHeader = request.headers.get('X-Hive-Identity')
  const isValid = await verifyAgentToken(agentAuthHeader)
  
  if (!isValid) {
    // Quarantine request
    return NextResponse.json({ error: 'ROGUE NODE DETECTED' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
```

### Rate Limiting Middleware

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getDB } from '@/lib/db'

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export async function middleware(request: NextRequest) {
  const ip = request.ip || '127.0.0.1'
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute
  const maxRequests = 100

  // Clean up expired entries
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key)
    }
  }

  const current = rateLimitMap.get(ip)
  
  if (!current) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
  } else if (now > current.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
  } else if (current.count >= maxRequests) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    )
  } else {
    current.count++
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
```

### Database Connection Middleware

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getDB } from '@/lib/db'

export async function middleware(request: NextRequest) {
  // Test database connection for health checks
  if (request.nextUrl.pathname === '/api/health') {
    try {
      const db = await getDB()
      await db.execute('SELECT 1')
      
      return NextResponse.json({ 
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      return NextResponse.json(
        { 
          status: 'unhealthy',
          database: 'disconnected',
          error: error.message,
          timestamp: new Date().toISOString()
        },
        { status: 503 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
```

## Error Handling

### Global Error Handler

```typescript
// app/error.tsx
'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
        <p className="text-gray-600 mb-6">
          {error.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={reset}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
```

### Error Boundary Component

```typescript
// components/ErrorBoundary.tsx
'use client'

import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 border border-red-200 rounded-lg bg-red-50">
          <h3 className="text-red-800 font-semibold">Something went wrong</h3>
          <p className="text-red-600 text-sm mt-1">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
        </div>
      )
    }

    return this.props.children
  }
}
```

## Performance Optimization

### Caching Strategies

```typescript
// lib/cache.ts
import { unstable_cache } from 'next/cache'
import { getDB } from './db'

export const getCachedUsers = unstable_cache(
  async () => {
    const db = await getDB()
    const userRepo = db.getRepository('users')
    return userRepo.findAll({ limit: 100 })
  },
  ['users'],
  { revalidate: 300 } // 5 minutes
)

export const getCachedUser = unstable_cache(
  async (id: number) => {
    const db = await getDB()
    const userRepo = db.getRepository('users')
    return userRepo.findById(id)
  },
  ['user'],
  { revalidate: 600 } // 10 minutes
)
```

### Database Connection Pooling

```typescript
// lib/db-pool.ts
import { NOORMME } from 'noormme'

class DatabasePool {
  private connections: NOORMME[] = []
  private maxConnections = 10
  private currentConnections = 0

  async getConnection(): Promise<NOORMME> {
    if (this.connections.length > 0) {
      return this.connections.pop()!
    }

    if (this.currentConnections < this.maxConnections) {
      const db = new NOORMME({
        dialect: 'sqlite',
        connection: { database: './app.db' },
        optimization: {
          enableWALMode: true,
          cacheSize: -32000
        }
      })
      
      await db.initialize()
      this.currentConnections++
      
      return db
    }

    // Wait for a connection to become available
    return new Promise((resolve) => {
      const checkForConnection = () => {
        if (this.connections.length > 0) {
          resolve(this.connections.pop()!)
        } else {
          setTimeout(checkForConnection, 10)
        }
      }
      checkForConnection()
    })
  }

  releaseConnection(db: NOORMME) {
    this.connections.push(db)
  }

  async closeAll() {
    await Promise.all(
      this.connections.map(db => db.destroy())
    )
    this.connections = []
    this.currentConnections = 0
  }
}

export const dbPool = new DatabasePool()
```

## Best Practices

### 1. Connection Management
- Use singleton pattern for development
- Use connection pooling for production
- Always close connections in serverless environments

### 2. Error Handling
- Wrap database operations in try-catch blocks
- Provide meaningful error messages
- Log errors for debugging

### 3. Performance
- Use WAL mode for better concurrency
- Implement proper caching strategies
- Optimize queries with indexes

### 4. Security
- Validate all inputs
- Use parameterized queries
- Implement proper authentication

### 5. Monitoring
- Log slow queries
- Monitor connection usage
- Track performance metrics

This guide covers the essential patterns for integrating NOORMME with Next.js in production applications. Each pattern is designed to work efficiently with SQLite and the Next.js App Router.

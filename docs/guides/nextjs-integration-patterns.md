# Next.js Integration Patterns

Complete guide to integrating **The Agentic Data Engine** with Next.js App Router patterns for production-grade autonomous applications.

## Overview

NOORMME is designed to work seamlessly with Next.js App Router patterns:

- **Server Components** for data fetching
- **Server Actions** for form handling
- **Route Handlers** for API endpoints
- **Middleware** for authentication and routing
- **Edge Runtime** compatibility

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

## Server Components

### Basic Data Fetching

```typescript
// app/users/page.tsx
import { getDB } from '@/lib/db'
import { Suspense } from 'react'

export default async function UsersPage() {
  const db = await getDB()
  const userRepo = db.getRepository('users')
  
  const users = await userRepo.findAll({
    limit: 50,
    orderBy: { created_at: 'desc' }
  })

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Users</h1>
      
      <Suspense fallback={<div>Loading users...</div>}>
        <UserList users={users} />
      </Suspense>
    </div>
  )
}

function UserList({ users }: { users: any[] }) {
  return (
    <div className="grid gap-4">
      {users.map(user => (
        <div key={user.id} className="border rounded-lg p-4">
          <h3 className="font-semibold">{user.name}</h3>
          <p className="text-gray-600">{user.email}</p>
          <p className="text-sm text-gray-500">
            Joined: {new Date(user.created_at).toLocaleDateString()}
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

## Server Actions

### Basic Form Handling

```typescript
// app/users/new/actions.ts
'use server'

import { getDB } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  age: z.number().min(18, 'Must be at least 18 years old')
})

export async function createUser(formData: FormData) {
  try {
    // Validate form data
    const validatedData = createUserSchema.parse({
      name: formData.get('name'),
      email: formData.get('email'),
      age: parseInt(formData.get('age') as string)
    })

    const db = await getDB()
    const userRepo = db.getRepository('users')
    
    // Check if email already exists
    const existingUser = await userRepo.findByEmail(validatedData.email)
    if (existingUser) {
      throw new Error('Email already exists')
    }

    // Create user
    const user = await userRepo.create({
      name: validatedData.name,
      email: validatedData.email,
      age: validatedData.age
    })

    // Revalidate the users page
    revalidatePath('/users')
    
    // Redirect to the new user's page
    redirect(`/users/${user.id}`)
  } catch (error) {
    console.error('Error creating user:', error)
    throw new Error('Failed to create user')
  }
}
```

### Form with Error Handling

```typescript
// app/posts/new/actions.ts
'use server'

import { getDB } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export async function createPost(formData: FormData) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user?.id) {
      throw new Error('Unauthorized')
    }

    const title = formData.get('title') as string
    const content = formData.get('content') as string
    const published = formData.get('published') === 'on'

    if (!title || !content) {
      throw new Error('Title and content are required')
    }

    const db = await getDB()
    const postRepo = db.getRepository('posts')
    
    const post = await postRepo.create({
      title,
      content,
      author_id: session.user.id,
      published
    })

    revalidatePath('/posts')
    revalidatePath('/dashboard')
    
    redirect(`/posts/${post.id}`)
  } catch (error) {
    console.error('Error creating post:', error)
    throw new Error('Failed to create post')
  }
}

// Optimistic updates
export async function updatePost(postId: string, formData: FormData) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      throw new Error('Unauthorized')
    }

    const title = formData.get('title') as string
    const content = formData.get('content') as string
    const published = formData.get('published') === 'on'

    const db = await getDB()
    const postRepo = db.getRepository('posts')
    
    // Check ownership
    const post = await postRepo.findById(parseInt(postId))
    if (!post || post.author_id !== session.user.id) {
      throw new Error('Unauthorized')
    }

    await postRepo.update(parseInt(postId), {
      title,
      content,
      published
    })

    revalidatePath('/posts')
    revalidatePath(`/posts/${postId}`)
  } catch (error) {
    console.error('Error updating post:', error)
    throw new Error('Failed to update post')
  }
}
```

### Batch Operations

```typescript
// app/admin/users/actions.ts
'use server'

import { getDB } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export async function deleteUsers(userIds: string[]) {
  try {
    const db = await getDB()
    const userRepo = db.getRepository('users')
    
    // Batch delete
    await Promise.all(
      userIds.map(id => userRepo.delete(parseInt(id)))
    )

    revalidatePath('/admin/users')
  } catch (error) {
    console.error('Error deleting users:', error)
    throw new Error('Failed to delete users')
  }
}

export async function bulkUpdateUsers(updates: Array<{ id: string; data: any }>) {
  try {
    const db = await getDB()
    const userRepo = db.getRepository('users')
    
    // Batch update
    await Promise.all(
      updates.map(({ id, data }) => 
        userRepo.update(parseInt(id), data)
      )
    )

    revalidatePath('/admin/users')
  } catch (error) {
    console.error('Error updating users:', error)
    throw new Error('Failed to update users')
  }
}
```

## Route Handlers

### REST API Endpoints

```typescript
// app/api/users/route.ts
import { getDB } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const db = await getDB()
    const userRepo = db.getRepository('users')
    
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search')

    let users
    if (search) {
      users = await userRepo.findAll({
        where: {
          $or: [
            { name: { $like: `%${search}%` } },
            { email: { $like: `%${search}%` } }
          ]
        },
        limit,
        offset: (page - 1) * limit,
        orderBy: { created_at: 'desc' }
      })
    } else {
      users = await userRepo.findAll({
        limit,
        offset: (page - 1) * limit,
        orderBy: { created_at: 'desc' }
      })
    }

    const total = await userRepo.count()

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    
    const db = await getDB()
    const userRepo = db.getRepository('users')
    
    // Check if email already exists
    const existingUser = await userRepo.findByEmail(data.email)
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 400 }
      )
    }

    const user = await userRepo.create(data)

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}
```

### Dynamic Route Handlers

```typescript
// app/api/users/[id]/route.ts
import { getDB } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: { id: string }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const db = await getDB()
    const userRepo = db.getRepository('users')
    
    const user = await userRepo.findById(parseInt(params.id))
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const data = await request.json()
    
    const db = await getDB()
    const userRepo = db.getRepository('users')
    
    const user = await userRepo.update(parseInt(params.id), data)
    
    return NextResponse.json(user)
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const db = await getDB()
    const userRepo = db.getRepository('users')
    
    await userRepo.delete(parseInt(params.id))
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}
```

### WebSocket-like Real-time Updates

```typescript
// app/api/posts/stream/route.ts
import { getDB } from '@/lib/db'

export async function GET() {
  const encoder = new TextEncoder()
  
  const stream = new ReadableStream({
    start(controller) {
      const sendData = (data: any) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        )
      }

      // Send initial data
      sendData({ type: 'connected', timestamp: new Date().toISOString() })

      // Poll for new posts every 5 seconds
      const interval = setInterval(async () => {
        try {
          const db = await getDB()
          const postRepo = db.getRepository('posts')
          
          const recentPosts = await postRepo.findAll({
            where: { 
              created_at: { 
                $gte: new Date(Date.now() - 30000) // Last 30 seconds
              } 
            },
            limit: 10,
            orderBy: { created_at: 'desc' }
          })

          if (recentPosts.length > 0) {
            sendData({ 
              type: 'new_posts', 
              posts: recentPosts,
              timestamp: new Date().toISOString()
            })
          }
        } catch (error) {
          console.error('Error polling for posts:', error)
        }
      }, 5000)

      // Cleanup on close
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

### Authentication Middleware

```typescript
// middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/register', '/api/auth']
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Protected routes
  const session = await auth()
  
  if (!session) {
    // Redirect to login
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Admin routes
  if (pathname.startsWith('/admin')) {
    if (session.user.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
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

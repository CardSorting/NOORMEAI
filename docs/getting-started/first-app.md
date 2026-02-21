# Your First Agentic App (Powered by NOORMME)

Build a complete blog application in 5 minutes with **The Agentic Data Engine** and Next.js.

## What We're Building

A simple blog application with:
- User management
- Post creation and editing
- Comments system
- Next.js App Router integration

## Step 1: Setup Project

```bash
# Create Next.js app
npx create-next-app@latest my-blog-app --typescript --tailwind --eslint --app

# Navigate to project
cd my-blog-app

# Install NOORMME
npm install noormme
```

## Step 2: Create Database Schema

```bash
# Create SQLite database
sqlite3 blog.db

# Create tables
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_id INTEGER REFERENCES users(id),
  published BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  post_id INTEGER REFERENCES posts(id),
  author_id INTEGER REFERENCES users(id),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

.quit
```

## Step 3: Configure NOORMME

```typescript
// lib/db.ts
import { NOORMME } from 'noormme'

let db: NOORMME | null = null

export async function getDB(): Promise<NOORMME> {
  if (!db) {
    db = new NOORMME({
      dialect: 'sqlite',
      connection: {
        database: './blog.db'
      },
      optimization: {
        enableWALMode: true,
        enableForeignKeys: true,
        cacheSize: -64000
      },
      logging: {
        level: 'info',
        enabled: true
      }
    })
    await db.initialize()
  }
  return db
}
```

## Step 4: Create Home Page

```typescript
// app/page.tsx
import { getDB } from '@/lib/db'
import Link from 'next/link'

export default async function HomePage() {
  const db = await getDB()
  const postRepo = db.getRepository('posts')
  const userRepo = db.getRepository('users')
  
  // Get published posts with authors
  const posts = await postRepo.findAll({
    where: { published: true },
    orderBy: { created_at: 'desc' },
    limit: 10
  })
  
  // Get authors for each post
  const postsWithAuthors = await Promise.all(
    posts.map(async (post) => {
      const author = await userRepo.findById(post.author_id)
      return { ...post, author }
    })
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          My Blog
        </h1>
        <p className="text-gray-600">
          Built with NOORMME and Next.js
        </p>
      </header>

      <nav className="mb-8">
        <Link 
          href="/posts/new" 
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          New Post
        </Link>
      </nav>

      <div className="space-y-6">
        {postsWithAuthors.map((post) => (
          <article key={post.id} className="border-b pb-6">
            <h2 className="text-2xl font-semibold mb-2">
              <Link 
                href={`/posts/${post.id}`}
                className="text-blue-600 hover:text-blue-800"
              >
                {post.title}
              </Link>
            </h2>
            <p className="text-gray-600 mb-2">
              By {post.author?.name} on {new Date(post.created_at).toLocaleDateString()}
            </p>
            <p className="text-gray-700">
              {post.content.substring(0, 200)}...
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}
```

## Step 5: Create Post Detail Page

```typescript
// app/posts/[id]/page.tsx
import { getDB } from '@/lib/db'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface PostPageProps {
  params: { id: string }
}

export default async function PostPage({ params }: PostPageProps) {
  const db = await getDB()
  const postRepo = db.getRepository('posts')
  const userRepo = db.getRepository('users')
  const commentRepo = db.getRepository('comments')
  
  const post = await postRepo.findById(parseInt(params.id))
  
  if (!post) {
    notFound()
  }
  
  const author = await userRepo.findById(post.author_id)
  const comments = await commentRepo.findAll({
    where: { post_id: post.id },
    orderBy: { created_at: 'desc' }
  })
  
  const commentsWithAuthors = await Promise.all(
    comments.map(async (comment) => {
      const commentAuthor = await userRepo.findById(comment.author_id)
      return { ...comment, author: commentAuthor }
    })
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link 
        href="/" 
        className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
      >
        ← Back to Home
      </Link>
      
      <article className="mb-8">
        <h1 className="text-3xl font-bold mb-4">{post.title}</h1>
        <p className="text-gray-600 mb-6">
          By {author?.name} on {new Date(post.created_at).toLocaleDateString()}
        </p>
        <div className="prose max-w-none">
          <p className="whitespace-pre-wrap">{post.content}</p>
        </div>
      </article>

      <section className="border-t pt-8">
        <h2 className="text-2xl font-semibold mb-4">Comments</h2>
        
        {commentsWithAuthors.length === 0 ? (
          <p className="text-gray-600">No comments yet.</p>
        ) : (
          <div className="space-y-4">
            {commentsWithAuthors.map((comment) => (
              <div key={comment.id} className="border-l-4 border-blue-200 pl-4">
                <p className="font-semibold">{comment.author?.name}</p>
                <p className="text-gray-600 text-sm">
                  {new Date(comment.created_at).toLocaleDateString()}
                </p>
                <p className="mt-2">{comment.content}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
```

## Step 6: Create New Post Page

```typescript
// app/posts/new/page.tsx
import { createPost } from './actions'

export default function NewPostPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Create New Post</h1>
      
      <form action={createPost} className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
            Title
          </label>
          <input
            type="text"
            id="title"
            name="title"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-2">
            Content
          </label>
          <textarea
            id="content"
            name="content"
            rows={10}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              name="published"
              className="mr-2"
            />
            Publish immediately
          </label>
        </div>
        
        <div className="flex space-x-4">
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Create Post
          </button>
          <a
            href="/"
            className="bg-gray-300 text-gray-700 px-6 py-2 rounded-md hover:bg-gray-400"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  )
}
```

## Step 7: Create Server Actions

```typescript
// app/posts/new/actions.ts
'use server'

import { getDB } from '@/lib/db'
import { redirect } from 'next/navigation'

export async function createPost(formData: FormData) {
  const db = await getDB()
  const postRepo = db.getRepository('posts')
  
  const title = formData.get('title') as string
  const content = formData.get('content') as string
  const published = formData.get('published') === 'on'
  
  // For demo purposes, use author_id = 1
  // In a real app, you'd get this from the session
  const post = await postRepo.create({
    title,
    content,
    author_id: 1,
    published
  })
  
  redirect(`/posts/${post.id}`)
}
```

## Step 8: Seed Sample Data

```typescript
// scripts/seed.ts
import { NOORMME } from 'noormme'

async function seedDatabase() {
  const db = new NOORMME({
    dialect: 'sqlite',
    connection: { database: './blog.db' }
  })
  
  await db.initialize()
  
  const userRepo = db.getRepository('users')
  const postRepo = db.getRepository('posts')
  
  // Create sample user
  const user = await userRepo.create({
    name: 'John Doe',
    email: 'john@example.com'
  })
  
  // Create sample posts
  await postRepo.create({
    title: 'Welcome to My Blog',
    content: 'This is my first post using NOORMME and Next.js!',
    author_id: user.id,
    published: true
  })
  
  await postRepo.create({
    title: 'Building with NOORMME',
    content: 'NOORMME makes it easy to build database-driven applications with Next.js.',
    author_id: user.id,
    published: true
  })
  
  console.log('Database seeded successfully!')
  await db.destroy()
}

seedDatabase().catch(console.error)
```

```bash
# Run the seed script
npx tsx scripts/seed.ts
```

## Step 9: Run the Application

```bash
# Start the development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your blog!

## What You've Built

Congratulations! You've built a complete blog application with:

✅ **Database integration** with NOORMME  
✅ **Auto-discovery** of schema  
✅ **Type-safe** database operations  
✅ **Next.js App Router** integration  
✅ **Server Components** for data fetching  
✅ **Server Actions** for form handling  
✅ **Repository pattern** for clean code  

## Key Features Demonstrated

### 1. Auto-Discovery
NOORMME automatically discovered your database schema and generated types:

```typescript
// These types are auto-generated
interface User {
  id: number
  name: string
  email: string
  created_at: Date
}

interface Post {
  id: number
  title: string
  content: string
  author_id: number
  published: boolean
  created_at: Date
  updated_at: Date
}
```

### 2. Repository Pattern
Clean, type-safe database operations:

```typescript
const userRepo = db.getRepository('users')
const postRepo = db.getRepository('posts')

// Type-safe operations
await userRepo.create({ name: 'John', email: 'john@example.com' })
await postRepo.findAll({ where: { published: true } })
await postRepo.findById(1)
```

### 3. Next.js Integration
Seamless integration with Next.js patterns:

```typescript
// Server Components
export default async function HomePage() {
  const db = await getDB()
  const posts = await db.getRepository('posts').findAll()
  return <PostList posts={posts} />
}

// Server Actions
export async function createPost(formData: FormData) {
  'use server'
  const db = await getDB()
  await db.getRepository('posts').create(data)
  redirect('/')
}
```

### 4. WAL Mode Benefits
Your SQLite database now supports concurrent access:

```typescript
// Multiple readers can access simultaneously
// Writers don't block readers
// Better performance under load
```

## Next Steps

Now that you have a working blog application:

1. **Add authentication** with NextAuth
2. **Implement comments** functionality
3. **Add image uploads** for posts
4. **Create admin dashboard** for post management
5. **Add search** functionality
6. **Implement pagination** for posts

## Learn More

- **Repository Pattern**: [Guide](../guides/repository-pattern.md)
- **Migrations**: [Guide](../guides/migrations.md)
- **NextAuth Integration**: [Guide](../guides/nextauth-setup.md)
- **Examples**: [Real-world examples](../examples/)

Happy coding with NOORMME! 🚀

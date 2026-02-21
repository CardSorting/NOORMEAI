import { auth } from '@/lib/auth'
import { getDB } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function HomePage() {
  const session = await auth()
  
  if (session) {
    redirect('/dashboard')
  }

  const db = await getDB()
  const userRepo = db.getRepository('users')
  const userCount = await userRepo.count()

  return (
    <div className="px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          Welcome to NOORMME + NextAuth Example
        </h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4">What is this?</h2>
          <p className="text-gray-700 mb-4">
            This is a complete Next.js application demonstrating the integration between 
            NOORMME (Django-inspired ORM for Next.js) and NextAuth for authentication.
          </p>
          
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded">
              <h3 className="font-semibold text-blue-900">NOORMME Features</h3>
              <ul className="text-blue-800 text-sm mt-2 space-y-1">
                <li>• Auto-discovery of SQLite schema</li>
                <li>• WAL mode for concurrent access</li>
                <li>• Type-safe repository pattern</li>
                <li>• Django-inspired migrations</li>
              </ul>
            </div>
            
            <div className="bg-green-50 p-4 rounded">
              <h3 className="font-semibold text-green-900">NextAuth Features</h3>
              <ul className="text-green-800 text-sm mt-2 space-y-1">
                <li>• OAuth providers (Google, GitHub)</li>
                <li>• Credentials authentication</li>
                <li>• Session management</li>
                <li>• Protected routes</li>
              </ul>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded">
            <h3 className="font-semibold text-gray-900 mb-2">Database Stats</h3>
            <p className="text-gray-700">
              Current users in database: <span className="font-semibold">{userCount}</span>
            </p>
          </div>
        </div>

        <div className="text-center">
          <Link 
            href="/auth/signin"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Get Started - Sign In
          </Link>
        </div>

        <div className="mt-12 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-3">
            🚀 Quick Setup Guide
          </h3>
          <ol className="text-yellow-700 space-y-2 text-sm">
            <li>1. Copy your OAuth provider credentials to <code className="bg-yellow-100 px-1 rounded">.env.local</code></li>
            <li>2. Run <code className="bg-yellow-100 px-1 rounded">npm run db:setup</code> to create database tables</li>
            <li>3. Run <code className="bg-yellow-100 px-1 rounded">npm run dev</code> to start the development server</li>
            <li>4. Sign in with OAuth or create a credentials account</li>
          </ol>
        </div>
      </div>
    </div>
  )
}

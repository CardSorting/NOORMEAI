import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'NOORMME + NextAuth Example',
  description: 'Next.js app with NOORMME and NextAuth integration',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <header className="bg-white shadow">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <h1 className="text-xl font-semibold text-gray-900">
                    NOORMME + NextAuth
                  </h1>
                </div>
                <nav className="flex items-center space-x-4">
                  <a href="/" className="text-gray-700 hover:text-gray-900">
                    Home
                  </a>
                  <a href="/dashboard" className="text-gray-700 hover:text-gray-900">
                    Dashboard
                  </a>
                  <a href="/profile" className="text-gray-700 hover:text-gray-900">
                    Profile
                  </a>
                </nav>
              </div>
            </div>
          </header>
          <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  )
}

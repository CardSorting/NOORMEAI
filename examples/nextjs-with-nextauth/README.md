# NOORMME + NextAuth Example

A complete Next.js application demonstrating the integration between NOORMME (Django-inspired ORM for Next.js) and NextAuth for authentication.

## 🚀 Features

- **NOORMME Integration**: Auto-discovery, WAL mode, type-safe repositories
- **NextAuth Authentication**: OAuth providers (Google, GitHub) + credentials
- **Next.js App Router**: Modern Next.js 14 with App Router
- **TypeScript**: Full type safety throughout
- **SQLite Database**: Production-ready with WAL mode enabled
- **Protected Routes**: Authentication-based access control

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Google OAuth credentials (optional)
- GitHub OAuth credentials (optional)

## 🛠️ Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy `.env.local` and add your OAuth provider credentials:

```bash
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-change-this-in-production

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Database
DATABASE_URL=./data/app.db
```

### 3. Setup Database

```bash
npm run db:setup
```

This creates the SQLite database with NextAuth required tables.

### 4. Seed Sample Data (Optional)

```bash
npm run db:seed
```

### 5. Start Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 🔐 Authentication Methods

### OAuth Providers

1. **Google**: Set up at [Google Cloud Console](https://console.cloud.google.com/)
2. **GitHub**: Set up at [GitHub Developer Settings](https://github.com/settings/developers)

### Credentials Authentication

Use the sample credentials created by seeding:
- Email: `john@example.com` / Password: `password123`
- Email: `jane@example.com` / Password: `password123`
- Email: `bob@example.com` / Password: `password123`

## 🏗️ Architecture

### Database Layer (NOORMME)

```typescript
// src/lib/db.ts
import { NOORMME } from 'noormme'

export async function getDB(): Promise<NOORMME> {
  // Singleton pattern with WAL mode enabled
  return new NOORMME({
    dialect: 'sqlite',
    connection: { database: './data/app.db' },
    optimization: {
      enableWALMode: true,
      enableForeignKeys: true,
      cacheSize: -64000
    }
  })
}
```

### Authentication Layer (NextAuth)

```typescript
// src/lib/auth.ts
import NextAuth from 'next-auth'
import { NoormmeAdapter } from './nextauth-adapter'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: NoormmeAdapter(getDBForNextAuth()),
  providers: [
    GoogleProvider({ /* ... */ }),
    GitHubProvider({ /* ... */ }),
    CredentialsProvider({ /* ... */ })
  ],
  session: { strategy: 'database' }
})
```

### NextAuth Adapter

The `NoormmeAdapter` implements all required NextAuth methods:

- `createUser`, `getUser`, `getUserByEmail`, `getUserByAccount`
- `updateUser`, `deleteUser`
- `linkAccount`, `unlinkAccount`
- `createSession`, `getSessionAndUser`, `updateSession`, `deleteSession`
- `createVerificationToken`, `useVerificationToken`

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/auth/          # NextAuth API routes
│   ├── auth/signin/       # Custom sign-in page
│   ├── dashboard/         # Protected dashboard
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── providers.tsx      # Client providers
├── lib/
│   ├── auth.ts            # NextAuth configuration
│   ├── db.ts              # Database singleton
│   └── nextauth-adapter.ts # NOORMME NextAuth adapter
scripts/
├── setup-db.js            # Database initialization
└── seed-db.js             # Sample data seeding
```

## 🎯 Key Features Demonstrated

### 1. Auto-Discovery

NOORMME automatically discovers your SQLite schema:

```typescript
const db = await getDB()
const userRepo = db.getRepository('users')
const users = await userRepo.findAll() // Type-safe!
```

### 2. WAL Mode Benefits

- Concurrent read/write operations
- Better performance under load
- Crash recovery
- Reduced locking

### 3. Type Safety

Full TypeScript support with auto-generated types:

```typescript
interface User {
  id: string
  name: string | null
  email: string
  email_verified: string | null
  image: string | null
  created_at: string
  updated_at: string
}
```

### 4. Protected Routes

Server-side authentication with Next.js App Router:

```typescript
export default async function DashboardPage() {
  const session = await auth()
  
  if (!session) {
    redirect('/auth/signin')
  }
  
  // Protected content...
}
```

## 🔧 Customization

### Adding New OAuth Providers

1. Add provider to `src/lib/auth.ts`:

```typescript
import DiscordProvider from 'next-auth/providers/discord'

providers: [
  DiscordProvider({
    clientId: process.env.DISCORD_CLIENT_ID!,
    clientSecret: process.env.DISCORD_CLIENT_SECRET!,
  })
]
```

2. Add environment variables to `.env.local`
3. Restart the development server

### Adding Database Tables

1. Create migration or run SQL directly
2. NOORMME will auto-discover the new schema
3. Use the repository pattern:

```typescript
const postRepo = db.getRepository('posts')
const posts = await postRepo.findAll()
```

## 🚀 Production Deployment

### Environment Variables

Set these in your production environment:

```bash
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-production-secret
DATABASE_URL=/path/to/production.db
# ... OAuth provider credentials
```

### Database

- Use absolute paths for `DATABASE_URL`
- Ensure proper file permissions
- Consider SQLCipher for encryption
- Set up regular backups

### Performance

- WAL mode is enabled by default
- Cache size optimized for production
- Foreign keys enabled for data integrity

## 🐛 Troubleshooting

### Common Issues

1. **Database not found**: Run `npm run db:setup`
2. **OAuth errors**: Check provider credentials in `.env.local`
3. **Type errors**: Ensure TypeScript is properly configured
4. **Session issues**: Clear browser cookies and restart

### Debug Mode

Enable debug logging:

```typescript
// src/lib/db.ts
logging: {
  level: 'debug',
  enabled: true
}
```

## 📚 Learn More

- [NOORMME Documentation](../docs/)
- [NextAuth Documentation](https://next-auth.js.org/)
- [Next.js App Router](https://nextjs.org/docs/app)
- [SQLite WAL Mode](https://sqlite.org/wal.html)

## 🤝 Contributing

This example demonstrates the integration between NOORMME and NextAuth. Feel free to:

- Report issues
- Suggest improvements
- Submit pull requests
- Create additional examples

## 📄 License

MIT License - see LICENSE file for details.

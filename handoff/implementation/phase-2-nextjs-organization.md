# Phase 2: Next.js Organization Implementation Guide

## Overview

Phase 2 builds upon the solid SQLite foundation from Phase 1 to add Next.js organizational patterns. This phase applies proven organizational strategies from Django, Laravel, and Rails while maintaining Next.js's flexibility and performance.

## Current State

### ✅ From Phase 1
- **SQLite Automation**: Production-ready with auto-discovery and optimization
- **CLI Tools**: Comprehensive database management and project scaffolding
- **Performance**: Real-time monitoring and optimization
- **Migration System**: Complete schema evolution framework

### 🔄 Needs Implementation
- **Next.js Templates**: Project scaffolding with organizational structure
- **Authentication**: Complete NextAuth integration with RBAC
- **Admin Panel**: Basic CRUD interface with professional styling
- **Service Layer**: Laravel-style service classes
- **Middleware**: Django-style middleware patterns

## Week 3: Project Templates

### Day 1-2: Next.js Template Creation

#### Goal
Create comprehensive Next.js project template with Django-style organization.

#### Tasks

**1. Create Next.js Template Structure**
```
templates/nextjs/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Auth route group
│   │   │   ├── signin/        # Sign-in page
│   │   │   ├── signup/        # Sign-up page
│   │   │   └── layout.tsx     # Auth layout
│   │   ├── admin/             # Admin panel
│   │   │   ├── users/         # User management
│   │   │   ├── dashboard/     # Admin dashboard
│   │   │   └── layout.tsx     # Admin layout
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # Auth API routes
│   │   │   └── admin/         # Admin API routes
│   │   ├── dashboard/         # Protected dashboard
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Home page
│   │   └── providers.tsx      # Client providers
│   ├── lib/
│   │   ├── db.ts              # NOORMME database instance
│   │   ├── auth.ts            # NextAuth configuration
│   │   ├── services/          # Service layer
│   │   │   ├── base.service.ts
│   │   │   ├── user.service.ts
│   │   │   └── admin.service.ts
│   │   ├── repositories/      # Repository layer
│   │   │   ├── base.repository.ts
│   │   │   └── user.repository.ts
│   │   ├── middleware/        # Middleware layer
│   │   │   ├── auth.middleware.ts
│   │   │   └── admin.middleware.ts
│   │   └── utils/             # Utility functions
│   ├── components/
│   │   ├── ui/                # Reusable UI components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   └── table.tsx
│   │   ├── admin/             # Admin panel components
│   │   │   ├── user-table.tsx
│   │   │   ├── user-form.tsx
│   │   │   └── admin-layout.tsx
│   │   └── auth/              # Auth components
│   │       ├── signin-form.tsx
│   │       └── signup-form.tsx
│   └── types/
│       ├── database.ts        # Auto-generated types
│       └── api.ts             # API types
├── prisma/
│   └── schema.prisma          # Database schema (optional)
├── migrations/                # Database migrations
├── .env.local                 # Environment variables
├── .env.example               # Environment template
├── package.json               # Dependencies and scripts
├── tailwind.config.js         # TailwindCSS configuration
├── next.config.js             # Next.js configuration
└── README.md                  # Project documentation
```

**2. Template Generator Implementation**
```typescript
// src/cli/templates/nextjs-generator.ts
export class NextJSTemplateGenerator {
  async generateProject(options: {
    name: string
    features: string[]
    database?: string
  }): Promise<void> {
    // Implementation for Next.js template generation
  }

  async generateFiles(projectPath: string, options: any): Promise<void> {
    // Implementation for file generation
  }
}
```

**3. Django-style Folder Structure**
```typescript
// src/cli/templates/django-structure.ts
export class DjangoStructureGenerator {
  generateAppStructure(appName: string): AppStructure {
    return {
      models: `${appName}/models/`,
      views: `${appName}/views/`,
      services: `${appName}/services/`,
      components: `${appName}/components/`,
      types: `${appName}/types/`,
      utils: `${appName}/utils/`
    }
  }
}
```

#### Deliverables
- [ ] Next.js project template with organized structure
- [ ] Django-style folder hierarchy
- [ ] Template generator implementation
- [ ] Project scaffolding CLI command
- [ ] Template documentation

#### Success Criteria
- Project creation takes < 2 minutes
- Folder structure follows Django conventions
- Template includes all necessary files
- CLI command is intuitive and reliable

### Day 3-4: Authentication Integration

#### Goal
Complete NextAuth integration with RBAC system.

#### Tasks

**1. NextAuth Configuration**
```typescript
// templates/nextjs/src/lib/auth.ts
import NextAuth from 'next-auth'
import { NoormmeAdapter } from 'noormme/adapters/nextauth'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import CredentialsProvider from 'next-auth/providers/credentials'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: NoormmeAdapter(db),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const userRepo = db.getRepository('users')
        const user = await userRepo.findByEmail(credentials?.email)
        // Validation logic
        return user
      }
    })
  ],
  session: { strategy: 'database' },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error'
  }
})
```

**2. RBAC System Implementation**
```typescript
// src/auth/rbac.ts
export class RBACSystem {
  async checkPermission(
    userId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    // Implementation for permission checking
  }

  async assignRole(userId: string, role: string): Promise<void> {
    // Implementation for role assignment
  }

  async createPermission(
    resource: string,
    action: string
  ): Promise<Permission> {
    // Implementation for permission creation
  }
}
```

**3. Permission Middleware**
```typescript
// src/middleware/permission.middleware.ts
export function withPermission(
  resource: string,
  action: string
) {
  return async (req: NextRequest) => {
    // Implementation for permission middleware
  }
}
```

#### Deliverables
- [ ] Complete NextAuth configuration
- [ ] RBAC system implementation
- [ ] Permission checking middleware
- [ ] Role assignment functionality
- [ ] Authentication documentation

#### Success Criteria
- Authentication works with multiple providers
- RBAC system is functional
- Permission checking is reliable
- Middleware integrates seamlessly

### Day 5: Admin Panel Foundation

#### Goal
Create basic admin panel components with professional styling.

#### Tasks

**1. Admin Panel Layout**
```typescript
// templates/nextjs/src/components/admin/admin-layout.tsx
export default function AdminLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <AdminHeader />
        {children}
      </main>
    </div>
  )
}
```

**2. Data Table Components**
```typescript
// templates/nextjs/src/components/admin/data-table.tsx
export function DataTable<T>({
  data,
  columns,
  onEdit,
  onDelete
}: DataTableProps<T>) {
  return (
    <div className="data-table">
      <table>
        <thead>
          <tr>
            {columns.map(column => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(item => (
            <tr key={item.id}>
              {columns.map(column => (
                <td key={column.key}>
                  {column.render ? column.render(item) : item[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

**3. CRUD Form Components**
```typescript
// templates/nextjs/src/components/admin/crud-form.tsx
export function CrudForm<T>({
  entity,
  fields,
  onSubmit,
  onCancel
}: CrudFormProps<T>) {
  return (
    <form onSubmit={onSubmit}>
      {fields.map(field => (
        <div key={field.name}>
          <label>{field.label}</label>
          <input
            type={field.type}
            name={field.name}
            defaultValue={entity?.[field.name]}
          />
        </div>
      ))}
      <button type="submit">Save</button>
      <button type="button" onClick={onCancel}>Cancel</button>
    </form>
  )
}
```

#### Deliverables
- [ ] Admin panel layout component
- [ ] Data table components
- [ ] CRUD form components
- [ ] Professional styling
- [ ] Admin panel documentation

#### Success Criteria
- Admin panel is visually appealing
- Data tables are functional
- CRUD forms work correctly
- Styling is consistent and professional

## Week 4: Organizational Patterns

### Day 1-2: Service Layer Implementation

#### Goal
Implement Laravel-style service classes for business logic.

#### Tasks

**1. Service Base Class**
```typescript
// src/services/base.service.ts
export abstract class BaseService<T> {
  protected repository: Repository<T>
  protected db: NOORMME

  constructor(repository: Repository<T>, db: NOORMME) {
    this.repository = repository
    this.db = db
  }

  async create(data: Partial<T>): Promise<T> {
    return await this.repository.create(data)
  }

  async findById(id: string): Promise<T | null> {
    return await this.repository.findById(id)
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    return await this.repository.update(id, data)
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id)
  }
}
```

**2. User Service Implementation**
```typescript
// src/services/user.service.ts
export class UserService extends BaseService<User> {
  constructor(db: NOORMME) {
    super(db.getRepository('users'), db)
  }

  async createUser(data: CreateUserData): Promise<User> {
    // Business logic for user creation
    const user = await this.repository.create(data)
    // Additional processing
    return user
  }

  async getUserWithPosts(userId: string): Promise<UserWithPosts> {
    const kysely = this.db.getKysely()
    return await kysely
      .selectFrom('users')
      .leftJoin('posts', 'posts.user_id', 'users.id')
      .select(['users.*', 'posts.title'])
      .where('users.id', '=', userId)
      .execute()
  }

  async updateUserStatus(userId: string, status: UserStatus): Promise<User> {
    return await this.repository.update(userId, { status })
  }
}
```

**3. Admin Service Implementation**
```typescript
// src/services/admin.service.ts
export class AdminService extends BaseService<Admin> {
  constructor(db: NOORMME) {
    super(db.getRepository('admins'), db)
  }

  async getAdminDashboard(): Promise<AdminDashboard> {
    const userRepo = this.db.getRepository('users')
    const postRepo = this.db.getRepository('posts')
    
    const [userCount, postCount, recentUsers] = await Promise.all([
      userRepo.count(),
      postRepo.count(),
      userRepo.findMany({ limit: 10, orderBy: 'created_at DESC' })
    ])

    return {
      userCount,
      postCount,
      recentUsers
    }
  }

  async bulkUpdateUsers(userIds: string[], updates: Partial<User>): Promise<void> {
    // Implementation for bulk updates
  }
}
```

#### Deliverables
- [ ] Service base class implementation
- [ ] User service with business logic
- [ ] Admin service with dashboard functionality
- [ ] Service dependency injection
- [ ] Service documentation

#### Success Criteria
- Service classes encapsulate business logic
- Base class provides common functionality
- Services are testable and maintainable
- Dependency injection works correctly

### Day 3-4: Middleware Patterns

#### Goal
Implement Django-style middleware patterns for Next.js.

#### Tasks

**1. Middleware Base Class**
```typescript
// src/middleware/base.middleware.ts
export abstract class BaseMiddleware {
  abstract execute(
    req: NextRequest,
    context: any
  ): Promise<NextResponse | void>

  protected async next(
    req: NextRequest,
    context: any
  ): Promise<NextResponse | void> {
    // Implementation for middleware chaining
  }
}
```

**2. Authentication Middleware**
```typescript
// src/middleware/auth.middleware.ts
export class AuthMiddleware extends BaseMiddleware {
  async execute(req: NextRequest, context: any): Promise<NextResponse | void> {
    const session = await auth()
    
    if (!session) {
      return NextResponse.redirect(new URL('/auth/signin', req.url))
    }

    return this.next(req, context)
  }
}
```

**3. Authorization Middleware**
```typescript
// src/middleware/authorization.middleware.ts
export class AuthorizationMiddleware extends BaseMiddleware {
  constructor(
    private resource: string,
    private action: string
  ) {
    super()
  }

  async execute(req: NextRequest, context: any): Promise<NextResponse | void> {
    const session = await auth()
    
    if (!session) {
      return NextResponse.redirect(new URL('/auth/signin', req.url))
    }

    const hasPermission = await rbac.checkPermission(
      session.user.id,
      this.resource,
      this.action
    )

    if (!hasPermission) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }

    return this.next(req, context)
  }
}
```

**4. Logging Middleware**
```typescript
// src/middleware/logging.middleware.ts
export class LoggingMiddleware extends BaseMiddleware {
  async execute(req: NextRequest, context: any): Promise<NextResponse | void> {
    const start = Date.now()
    
    const response = await this.next(req, context)
    
    const duration = Date.now() - start
    
    console.log(`${req.method} ${req.url} - ${duration}ms`)
    
    return response
  }
}
```

#### Deliverables
- [ ] Middleware base class
- [ ] Authentication middleware
- [ ] Authorization middleware
- [ ] Logging middleware
- [ ] Middleware documentation

#### Success Criteria
- Middleware classes are reusable
- Authentication middleware works correctly
- Authorization middleware integrates with RBAC
- Logging middleware provides useful information

### Day 5: Testing & Documentation

#### Goal
Complete Phase 2 testing and documentation.

#### Tasks

**1. Organizational Pattern Tests**
```typescript
// test/organizational-patterns.test.ts
describe('Organizational Patterns', () => {
  test('should create service with business logic', async () => {
    // Test implementation
  })

  test('should execute middleware chain', async () => {
    // Test implementation
  })

  test('should handle RBAC permissions', async () => {
    // Test implementation
  })
})
```

**2. Example Applications**
```typescript
// examples/blog-app.ts
export class BlogApp {
  private userService: UserService
  private postService: PostService

  constructor(db: NOORMME) {
    this.userService = new UserService(db)
    this.postService = new PostService(db)
  }

  async createPost(userId: string, postData: CreatePostData): Promise<Post> {
    // Implementation for blog post creation
  }
}
```

**3. Pattern Documentation**
```markdown
# Organizational Patterns

## Service Layer
The service layer encapsulates business logic...

## Middleware
Middleware provides cross-cutting concerns...

## RBAC System
Role-based access control provides security...
```

#### Deliverables
- [ ] Test suite for organizational patterns
- [ ] Example applications
- [ ] Pattern documentation
- [ ] Migration guide from manual setup
- [ ] Best practices guide

#### Success Criteria
- Tests cover all organizational patterns
- Example applications demonstrate usage
- Documentation is comprehensive and clear
- Migration guide helps users adopt patterns

## Implementation Guidelines

### Code Organization

#### Folder Structure
- Follow Django-style organization
- Separate concerns clearly
- Use consistent naming conventions
- Group related functionality

#### Service Layer
- Encapsulate business logic
- Use dependency injection
- Follow single responsibility principle
- Make services testable

#### Middleware
- Keep middleware focused
- Use composition over inheritance
- Handle errors gracefully
- Provide useful logging

### Testing Strategy

#### Unit Tests
- Test individual components
- Mock dependencies
- Test edge cases
- Ensure good coverage

#### Integration Tests
- Test component interactions
- Use real database
- Test authentication flows
- Test authorization logic

#### End-to-End Tests
- Test complete user flows
- Test admin panel functionality
- Test API endpoints
- Test error handling

### Performance Considerations

#### Service Layer
- Cache expensive operations
- Use database transactions
- Optimize queries
- Handle errors gracefully

#### Middleware
- Keep middleware lightweight
- Avoid blocking operations
- Use efficient logging
- Handle timeouts properly

## Success Criteria

### Technical Excellence
- ✅ Next.js templates are comprehensive
- ✅ Organizational patterns are implemented
- ✅ RBAC system is complete
- ✅ Admin panel is functional
- ✅ Service layer is working

### Performance Metrics
- Project creation < 2 minutes
- Authentication response < 100ms
- Admin panel load < 500ms
- Service layer operations < 50ms

### User Experience
- Templates are easy to use
- Patterns are intuitive
- Documentation is clear
- Examples are helpful

## Risk Mitigation

### Technical Risks
- **Template Complexity**: Keep templates simple and well-documented
- **Middleware Performance**: Optimize middleware for performance
- **RBAC Complexity**: Keep RBAC system simple and focused
- **Service Layer Coupling**: Use dependency injection to reduce coupling

### Project Risks
- **Scope Creep**: Focus on core organizational patterns
- **Timeline Delays**: Prioritize essential features
- **Quality Issues**: Regular testing and code reviews
- **User Adoption**: Provide clear documentation and examples

## Conclusion

Phase 2 successfully adds Next.js organizational patterns to NOORMME's SQLite foundation. By the end of this phase, developers will have:

1. **Comprehensive Next.js templates** with Django-style organization
2. **Complete authentication system** with RBAC
3. **Functional admin panel** with professional styling
4. **Laravel-style service layer** for business logic
5. **Django-style middleware** for cross-cutting concerns

This organizational layer enables Phase 3's developer experience enhancements to build upon a well-structured, maintainable, and scalable foundation.

---

**Status**: ✅ Ready for implementation
**Timeline**: 2 weeks
**Next Phase**: Phase 3 - Developer Experience
**Success Criteria**: All deliverables completed and tested

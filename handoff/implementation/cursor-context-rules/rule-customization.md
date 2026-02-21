# Cursor Context Rules Customization

## Overview

This guide explains how to customize the NOORMME Cursor context rules to match your specific project needs and preferences.

## Rule File Structure

Each rule file follows this structure:

```markdown
---
description: [Brief description of the rule]
globs: [File patterns the rule applies to]
alwaysApply: [true/false]
---

# Rule Content
[Detailed guidelines and examples]
```

## Customization Options

### 1. Metadata Customization

#### Description
```markdown
---
description: Custom description for your project
---
```

#### File Patterns (globs)
```markdown
---
globs: '**/*.{ts,tsx}'  # TypeScript and TSX files
globs: '**/services/**' # Only service files
globs: '**/*.test.ts'   # Only test files
---
```

#### Application Scope
```markdown
---
alwaysApply: true   # Always include in context
alwaysApply: false  # Only when explicitly referenced
---
```

### 2. Content Customization

#### Add Project-Specific Patterns
```markdown
## Custom Service Pattern
```typescript
export class CustomService extends BaseService<Entity> {
  constructor(db: NOORMME) {
    super(db.getRepository('entity'), db)
  }

  // Custom business logic
  async customMethod(): Promise<Result> {
    // Implementation
  }
}
```
```

#### Modify Coding Standards
```markdown
## Custom Naming Conventions
- **Variables**: camelCase with prefix (e.g., `appUserName`)
- **Functions**: verbNoun pattern (e.g., `getUserData`)
- **Classes**: PascalCase with suffix (e.g., `UserServiceClass`)
```

#### Update Architecture Guidelines
```markdown
## Custom Layer Structure
- **Presentation Layer**: React components
- **Business Layer**: Service classes
- **Data Layer**: Repository classes
- **Infrastructure Layer**: Database and external services
```

### 3. Rule Organization

#### Split Large Rules
Break down complex rules into focused, smaller rules:

```markdown
# Instead of one large "architecture.mdc"
# Create multiple focused rules:

# architecture-core.mdc
# architecture-patterns.mdc
# architecture-guidelines.mdc
```

#### Combine Related Rules
Merge similar rules for better organization:

```markdown
# Combine coding-style.mdc and database.mdc
# into "development-standards.mdc"
```

### 4. Project-Specific Customizations

#### Add Domain-Specific Patterns
```markdown
## E-commerce Patterns
```typescript
export class ProductService extends BaseService<Product> {
  async calculatePrice(productId: string, quantity: number): Promise<number> {
    // Custom pricing logic
  }
}
```
```

#### Include Company Standards
```markdown
## Company Coding Standards
- Use company-specific error handling
- Follow internal naming conventions
- Include company branding in comments
```

#### Add Technology-Specific Rules
```markdown
## React Native Patterns
```typescript
export class MobileService extends BaseService<MobileEntity> {
  async syncWithServer(): Promise<void> {
    // Mobile-specific sync logic
  }
}
```
```

## Customization Examples

### Example 1: Stricter TypeScript Rules
```markdown
---
description: Strict TypeScript guidelines
globs: '**/*.ts'
alwaysApply: true
---

# Strict TypeScript Rules

## Type Safety
- Never use `any` type
- Always define explicit return types
- Use strict null checks
- Prefer interfaces over type aliases

## Code Examples
```typescript
// Good
interface UserData {
  id: string
  name: string
  email: string
}

function getUserById(id: string): Promise<UserData | null> {
  // Implementation
}

// Bad
function getUser(id: any): any {
  // Implementation
}
```
```

### Example 2: Testing-Focused Rules
```markdown
---
description: Testing standards and patterns
globs: '**/*.test.{ts,tsx}'
alwaysApply: true
---

# Testing Guidelines

## Test Structure
- Use describe blocks for grouping
- Use test blocks for individual tests
- Include setup and teardown
- Mock external dependencies

## Code Examples
```typescript
describe('UserService', () => {
  let userService: UserService
  let mockDb: jest.Mocked<NOORMME>

  beforeEach(() => {
    mockDb = createMockDatabase()
    userService = new UserService(mockDb)
  })

  test('should create user with valid data', async () => {
    // Test implementation
  })
})
```
```

### Example 3: Performance-Focused Rules
```markdown
---
description: Performance optimization guidelines
globs: '**/*.{ts,tsx}'
alwaysApply: false
---

# Performance Guidelines

## Database Optimization
- Use indexes for frequently queried columns
- Implement pagination for large datasets
- Cache expensive operations
- Monitor query performance

## Code Examples
```typescript
export class OptimizedService extends BaseService<Entity> {
  async findManyPaginated(
    page: number,
    limit: number
  ): Promise<PaginatedResult<Entity>> {
    // Optimized pagination implementation
  }
}
```
```

## Best Practices

### 1. Keep Rules Focused
- Each rule should address a specific aspect
- Avoid overly broad rules
- Use clear, actionable guidelines

### 2. Provide Examples
- Include code examples for each pattern
- Show both good and bad examples
- Explain the reasoning behind guidelines

### 3. Regular Updates
- Review rules periodically
- Update rules as the project evolves
- Remove outdated patterns

### 4. Team Collaboration
- Share rule updates with the team
- Get feedback on rule effectiveness
- Document rule changes

## Testing Customizations

### 1. Test Rule Application
```bash
# Create a test file
echo "// Test file" > test-rule.ts

# Check if AI follows custom rules
# Ask AI to generate code in the test file
```

### 2. Verify Rule Effectiveness
- Generate code with different scenarios
- Check that custom patterns are followed
- Ensure rules don't conflict with each other

### 3. Performance Testing
- Monitor AI response times
- Check for rule conflicts
- Optimize rule order and scope

## Maintenance

### 1. Regular Reviews
- Monthly rule effectiveness reviews
- Quarterly rule content updates
- Annual rule architecture review

### 2. Version Control
- Track rule changes in git
- Tag rule versions
- Document breaking changes

### 3. Team Training
- Train team members on rule usage
- Share best practices
- Collect feedback and suggestions

## Troubleshooting Customizations

### Common Issues

#### Rules Not Applying
- Check `globs` patterns
- Verify `alwaysApply` settings
- Ensure proper file structure

#### Conflicting Rules
- Review rule priorities
- Check for overlapping patterns
- Test rule combinations

#### Performance Issues
- Reduce `alwaysApply: true` rules
- Optimize `globs` patterns
- Split large rules

### Solutions

#### Rule Conflicts
```markdown
# Use more specific globs
globs: '**/services/**/*.ts'  # Instead of '**/*.ts'
```

#### Performance Optimization
```markdown
# Use conditional application
alwaysApply: false  # Instead of true
# Reference with @ruleName when needed
```

---

**Status**: ✅ Customization guide complete
**Next**: Apply customizations to match your project needs

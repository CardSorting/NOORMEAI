# NOORMME Authentication Tests

This directory contains comprehensive authentication tests for NOORMME, specifically focusing on OAuth callback issues and NextAuth.js integration.

## Test Files

### 1. `nextauth-adapter.test.ts`
Tests the NextAuth.js adapter implementation with NOORMME:
- User management (create, get, update, delete)
- Account linking and unlinking
- Session management (create, get, update, delete)
- Verification token handling
- Complete OAuth flow integration
- Error handling and edge cases

### 2. `oauth-flow.test.ts`
Tests OAuth callback flows and scenarios:
- GitHub OAuth callback simulation
- Google OAuth callback simulation
- Existing user login with new providers
- Users without email (GitHub private email)
- OAuth error scenarios (foreign key violations, duplicate accounts, invalid tokens)
- Session validation and expiration
- Database strategy vs JWT strategy comparison
- Concurrent OAuth callbacks
- OAuth callback debugging scenarios

### 3. `database-strategy.test.ts`
Tests database session strategy implementation:
- Database strategy benefits over JWT strategy
- Session persistence and management
- Session expiration handling
- Session updates and deletion
- Strategy comparison (database vs JWT)
- OAuth flow with database strategy
- Multiple OAuth providers
- Concurrent session creation
- Session cleanup and cascading deletes
- Performance and scalability tests

### 4. `error-scenarios.test.ts`
Tests error scenarios and edge cases:
- Original OAuth callback issues (now fixed)
- Database constraint violations
- Connection and performance issues
- Edge cases and boundary conditions
- Security edge cases (SQL injection, XSS)
- Recovery and resilience testing

## Key Test Scenarios

### OAuth Callback Debugging
These tests specifically address the issues described in `12-oauth-callback-debugging.md`:

1. **NOORMME Initialization Issues**
   - Tests empty database initialization (now fixed with pragma syntax corrections)
   - Tests schema discovery on empty databases
   - Tests graceful error handling during initialization

2. **NextAuth Strategy Mismatch**
   - Tests JWT strategy problems (user not persisted)
   - Tests database strategy benefits (user persisted)
   - Tests why OAuth callbacks fail with JWT + database adapter

3. **Database Schema Issues**
   - Tests missing table scenarios
   - Tests foreign key constraint violations
   - Tests unique constraint violations

### Authentication Flow Testing
- Complete OAuth provider integration (GitHub, Google)
- User creation and account linking
- Session management and validation
- Error handling and recovery
- Security and edge case testing

## Running the Tests

### Run All Authentication Tests
```bash
npm test -- --testPathPattern=authentication
```

### Run Specific Test Files
```bash
# NextAuth adapter tests
npm test -- test-comprehensive/authentication/nextauth-adapter.test.ts

# OAuth flow tests
npm test -- test-comprehensive/authentication/oauth-flow.test.ts

# Database strategy tests
npm test -- test-comprehensive/authentication/database-strategy.test.ts

# Error scenario tests
npm test -- test-comprehensive/authentication/error-scenarios.test.ts
```

### Run with Coverage
```bash
npm test -- --coverage --testPathPattern=authentication
```

## Test Dependencies

The authentication tests require:
- Jest testing framework
- NOORMME library
- SQLite database
- Node.js crypto module for UUID generation

## Database Setup

Each test creates its own temporary SQLite database file to ensure test isolation. The databases are automatically cleaned up after each test.

### Required Tables
The tests create the following tables to simulate NextAuth.js requirements:
- `users` - User information
- `accounts` - OAuth account linking
- `sessions` - User sessions
- `verification_tokens` - Email verification tokens

## Mock Implementations

The tests include mock implementations of:
- NextAuth.js adapter methods
- OAuth provider responses
- Session management
- User authentication flows

## Coverage

These tests provide comprehensive coverage of:
- ✅ NOORMME initialization with empty databases
- ✅ SQLite pragma syntax handling
- ✅ NextAuth.js adapter functionality
- ✅ OAuth callback flows
- ✅ Database vs JWT strategy differences
- ✅ Error handling and edge cases
- ✅ Security scenarios
- ✅ Performance and scalability
- ✅ Recovery and resilience

## Integration with Main Tests

These authentication tests complement the existing NOORMME test suite by focusing specifically on authentication and OAuth scenarios that were previously problematic.

The tests verify that the fixes implemented for the OAuth callback debugging issues are working correctly and provide ongoing regression testing for authentication-related functionality.

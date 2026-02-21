/**
 * Jest setup file for NOORMME tests
 */

// Global test setup
beforeAll(async () => {
  // Simple setup without external dependencies
  console.log('Setting up test environment...')
})

// Global test teardown
afterAll(async () => {
  // Simple teardown
  console.log('Tearing down test environment...')
})

// Increase timeout for database operations
jest.setTimeout(30000)

// Mock console methods in tests unless explicitly needed
const originalConsole = { ...console }

beforeEach(() => {
  // Reset console mocks before each test
  // Note: We don't mock console.error to allow error visibility in tests
  console.log = jest.fn()
  console.warn = jest.fn()
  console.info = jest.fn()
})

afterEach(() => {
  // Restore console after each test if needed
  // Uncomment if you want to see console output in tests
  // Object.assign(console, originalConsole)
})

// Global error handler for unhandled rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})

// Set test environment variables
process.env.NODE_ENV = 'test'
process.env.LOG_LEVEL = 'error' // Reduce noise in tests
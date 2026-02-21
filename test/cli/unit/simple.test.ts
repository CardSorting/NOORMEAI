import { jest, describe, it, expect } from '@jest/globals'

describe('Simple CLI Test', () => {
  it('should pass basic test', () => {
    expect(1 + 1).toBe(2)
  })

  it('should create mock NOORMME', () => {
    const mockNOORMME = global.createMockNOORMME()
    expect(mockNOORMME).toBeDefined()
    expect(mockNOORMME.initialize).toBeDefined()
    expect(mockNOORMME.getSchemaInfo).toBeDefined()
  })

  it('should create mock schema info', () => {
    const mockSchemaInfo = global.createMockSchemaInfo()
    expect(mockSchemaInfo).toBeDefined()
    expect(mockSchemaInfo.tables).toBeDefined()
    expect(mockSchemaInfo.tables.length).toBeGreaterThan(0)
  })
})

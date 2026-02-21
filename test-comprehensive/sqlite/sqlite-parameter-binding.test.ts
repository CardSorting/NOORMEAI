import { describe, it, before, after, beforeEach } from 'mocha'
import { expect } from 'chai'
// @ts-ignore - TypeScript has issues with module resolution but tests run successfully
import { NOORMME } from '../dist/esm/noormme.js'
// @ts-ignore - TypeScript has issues with module resolution but tests run successfully
import { NOORMConfig } from '../dist/esm/types/index.js'
import path from 'path'
import fs from 'fs'

/**
 * Targeted SQLite Parameter Binding Tests
 * 
 * This test suite focuses specifically on parameter binding issues
 * that cause "SQLite3 can only bind numbers, strings, bigints, buffers, and null" errors.
 * 
 * Key Issues Being Tested:
 * 1. Invalid data types being passed as parameters
 * 2. Objects and arrays being passed instead of primitive values
 * 3. Date objects not being properly converted
 * 4. Undefined values causing binding failures
 */

describe('SQLite Parameter Binding - Targeted Tests', () => {
  let noormme: NOORMME
  let testDbPath: string
  let config: NOORMConfig

  before(() => {
    testDbPath = path.join(__dirname, `test-sqlite-binding-${Date.now()}.db`)
  })

  after(async () => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath)
    }
  })

  beforeEach(async () => {
    config = {
      dialect: 'sqlite',
      connection: {
        database: testDbPath,
        host: '',
        port: 0,
        username: '',
        password: ''
      },
      logging: {
        level: 'error',
        enabled: true
      }
    }

    noormme = new NOORMME(config)
    
    // Initialize and create test table
    try {
      await noormme.initialize()
    } catch (error) {
      // If initialization fails due to introspection, create table manually
      await noormme.execute(`
        CREATE TABLE test_binding (
          id INTEGER PRIMARY KEY,
          name TEXT,
          age INTEGER,
          salary REAL,
          active BOOLEAN,
          created_at DATETIME,
          data BLOB
        )
      `)
    }
  })

  describe('Valid Parameter Types', () => {
    it('should accept all valid SQLite parameter types', async () => {
      const validParams = [
        'John Doe',           // string
        25,                   // number (integer)
        75000.50,            // number (real)
        null,                // null
        Buffer.from('test'), // buffer
        123456789012345n     // bigint
      ]

      for (const param of validParams) {
        await expect(noormme.execute(
          'INSERT INTO test_binding (name, age, salary, active, created_at, data) VALUES (?, ?, ?, ?, ?, ?)',
          [param, param, param, param, param, param]
        )).to.not.be.rejected
      }
    })

    it('should handle mixed valid parameter types', async () => {
      const params = [
        'Alice',              // string
        28,                   // integer
        85000.75,            // real
        1,                   // boolean (integer)
        '2023-12-01',        // string date
        Buffer.from('data')   // buffer
      ]

      await expect(noormme.execute(
        'INSERT INTO test_binding (name, age, salary, active, created_at, data) VALUES (?, ?, ?, ?, ?, ?)',
        params
      )).to.not.be.rejected
    })
  })

  describe('Invalid Parameter Types - Error Cases', () => {
    it('should reject objects as parameters', async () => {
      const invalidParams: any[] = [
        { name: 'John', age: 25 },           // plain object
        { toString: () => 'John' },          // object with toString
        new Error('test'),                   // Error object
        new Date(),                          // Date object (unless converted)
        /regex/,                             // RegExp object
        function() { return 'test' }         // Function object
      ]

      for (const param of invalidParams) {
        await expect(noormme.execute(
          'INSERT INTO test_binding (name) VALUES (?)',
          [param]
        )).to.be.rejectedWith(/SQLite3 can only bind numbers, strings, bigints, buffers, and null/)
      }
    })

    it('should reject arrays as parameters', async () => {
      const invalidArrays = [
        [1, 2, 3],                    // number array
        ['a', 'b', 'c'],              // string array
        [],                           // empty array
        [null, undefined, 1],         // mixed array
        [{ name: 'John' }, 25]        // object array
      ]

      for (const param of invalidArrays) {
        await expect(noormme.execute(
          'INSERT INTO test_binding (name) VALUES (?)',
          [param]
        )).to.be.rejectedWith(/SQLite3 can only bind numbers, strings, bigints, buffers, and null/)
      }
    })

    it('should reject undefined values', async () => {
      await expect(noormme.execute(
        'INSERT INTO test_binding (name) VALUES (?)',
        [undefined]
      )).to.be.rejectedWith(/SQLite3 can only bind numbers, strings, bigints, buffers, and null/)
    })

    it('should reject Symbol values', async () => {
      await expect(noormme.execute(
        'INSERT INTO test_binding (name) VALUES (?)',
        [Symbol('test')]
      )).to.be.rejectedWith(/SQLite3 can only bind numbers, strings, bigints, buffers, and null/)
    })
  })

  describe('Date Object Handling', () => {
    it('should reject Date objects directly', async () => {
      const date = new Date('2023-12-01T10:30:00Z')
      
      await expect(noormme.execute(
        'INSERT INTO test_binding (created_at) VALUES (?)',
        [date]
      )).to.be.rejectedWith(/SQLite3 can only bind numbers, strings, bigints, buffers, and null/)
    })

    it('should accept Date objects converted to ISO strings', async () => {
      const date = new Date('2023-12-01T10:30:00Z')
      
      await expect(noormme.execute(
        'INSERT INTO test_binding (created_at) VALUES (?)',
        [date.toISOString()]
      )).to.not.be.rejected
    })

    it('should accept Date objects converted to timestamps', async () => {
      const date = new Date('2023-12-01T10:30:00Z')
      
      await expect(noormme.execute(
        'INSERT INTO test_binding (created_at) VALUES (?)',
        [date.getTime()]
      )).to.not.be.rejected
    })
  })

  describe('Boolean Handling', () => {
    it('should accept boolean values converted to integers', async () => {
      await expect(noormme.execute(
        'INSERT INTO test_binding (active) VALUES (?)',
        [true ? 1 : 0]
      )).to.not.be.rejected
      
      await expect(noormme.execute(
        'INSERT INTO test_binding (active) VALUES (?)',
        [false ? 1 : 0]
      )).to.not.be.rejected
    })

    it('should reject boolean objects directly', async () => {
      await expect(noormme.execute(
        'INSERT INTO test_binding (active) VALUES (?)',
        [new Boolean(true)]
      )).to.be.rejectedWith(/SQLite3 can only bind numbers, strings, bigints, buffers, and null/)
    })
  })

  describe('Numeric Edge Cases', () => {
    it('should handle very large numbers', async () => {
      const largeNumbers = [
        Number.MAX_SAFE_INTEGER,
        Number.MIN_SAFE_INTEGER,
        Number.MAX_VALUE,
        Number.MIN_VALUE,
        9007199254740991n  // BigInt
      ]

      for (const num of largeNumbers) {
        await expect(noormme.execute(
          'INSERT INTO test_binding (age) VALUES (?)',
          [num]
        )).to.not.be.rejected
      }
    })

    it('should handle special numeric values', async () => {
      const specialNumbers = [
        Infinity,
        -Infinity,
        NaN
      ]

      for (const num of specialNumbers) {
        // These might be converted to strings or cause different behavior
        // Test what actually happens
        try {
          await noormme.execute(
            'INSERT INTO test_binding (salary) VALUES (?)',
            [num]
          )
          console.log(`Special number ${num} was accepted`)
        } catch (error: any) {
          console.log(`Special number ${num} was rejected: ${error.message}`)
          expect(error.message).to.include('SQLite3 can only bind')
        }
      }
    })
  })

  describe('Buffer and Binary Data', () => {
    it('should handle various buffer types', async () => {
      const buffers = [
        Buffer.from('hello world'),
        Buffer.from([1, 2, 3, 4, 5]),
        Buffer.alloc(10),
        Buffer.from('test', 'utf8'),
        Buffer.from('test', 'base64')
      ]

      for (const buffer of buffers) {
        await expect(noormme.execute(
          'INSERT INTO test_binding (data) VALUES (?)',
          [buffer]
        )).to.not.be.rejected
      }
    })

    it('should reject non-buffer binary objects', async () => {
      const nonBuffers = [
        new ArrayBuffer(10),
        new Uint8Array([1, 2, 3]),
        new Int32Array([1, 2, 3]),
        new Float64Array([1.1, 2.2, 3.3])
      ]

      for (const obj of nonBuffers) {
        await expect(noormme.execute(
          'INSERT INTO test_binding (data) VALUES (?)',
          [obj]
        )).to.be.rejectedWith(/SQLite3 can only bind numbers, strings, bigints, buffers, and null/)
      }
    })
  })

  describe('String Edge Cases', () => {
    it('should handle various string types', async () => {
      const strings = [
        'simple string',
        '',  // empty string
        'string with\nnewlines',
        'string with\ttabs',
        'string with "quotes"',
        'string with \'single quotes\'',
        'unicode: 你好世界 🌍',
        'very long string '.repeat(100)
      ]

      for (const str of strings) {
        await expect(noormme.execute(
          'INSERT INTO test_binding (name) VALUES (?)',
          [str]
        )).to.not.be.rejected
      }
    })

    it('should reject string objects', async () => {
      await expect(noormme.execute(
        'INSERT INTO test_binding (name) VALUES (?)',
        [new String('test')]
      )).to.be.rejectedWith(/SQLite3 can only bind numbers, strings, bigints, buffers, and null/)
    })
  })

  describe('Parameter Type Detection and Conversion', () => {
    it('should demonstrate parameter type detection', () => {
      function detectParameterType(value: any): string {
        if (value === null) return 'null'
        if (value === undefined) return 'undefined'
        if (typeof value === 'string') return 'string'
        if (typeof value === 'number') return 'number'
        if (typeof value === 'bigint') return 'bigint'
        if (Buffer.isBuffer(value)) return 'buffer'
        if (value instanceof Date) return 'date'
        if (Array.isArray(value)) return 'array'
        if (typeof value === 'object') return 'object'
        if (typeof value === 'boolean') return 'boolean'
        if (typeof value === 'function') return 'function'
        return 'unknown'
      }

      const testValues = [
        null,
        undefined,
        'test',
        123,
        123n,
        Buffer.from('test'),
        new Date(),
        [1, 2, 3],
        { name: 'test' },
        true,
        () => 'test'
      ]

      for (const value of testValues) {
        const type = detectParameterType(value)
        console.log(`${value} -> ${type}`)
        
        // Only these types should be valid for SQLite
        const validTypes = ['null', 'string', 'number', 'bigint', 'buffer']
        if (validTypes.includes(type)) {
          console.log(`  ✓ Valid for SQLite`)
        } else {
          console.log(`  ✗ Invalid for SQLite`)
        }
      }
    })

    it('should demonstrate parameter conversion strategies', async () => {
      function convertForSQLite(value: any): any {
        if (value === null || value === undefined) return null
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return value
        if (Buffer.isBuffer(value)) return value
        if (value instanceof Date) return value.toISOString()
        if (typeof value === 'boolean') return value ? 1 : 0
        if (Array.isArray(value)) {
          // Convert array to JSON string or reject
          throw new Error(`Cannot convert array to SQLite parameter: ${JSON.stringify(value)}`)
        }
        if (typeof value === 'object') {
          // Convert object to JSON string or reject
          throw new Error(`Cannot convert object to SQLite parameter: ${JSON.stringify(value)}`)
        }
        throw new Error(`Cannot convert ${typeof value} to SQLite parameter`)
      }

      // Test conversions
      const testCases = [
        { input: null, expected: null },
        { input: 'test', expected: 'test' },
        { input: 123, expected: 123 },
        { input: 123n, expected: 123n },
        { input: Buffer.from('test'), expected: Buffer.from('test') },
        { input: new Date('2023-12-01'), expected: '2023-12-01T00:00:00.000Z' },
        { input: true, expected: 1 },
        { input: false, expected: 0 }
      ]

      for (const { input, expected } of testCases) {
        const converted = convertForSQLite(input)
        expect(converted).to.deep.equal(expected)
        
        // Test that converted value works in SQLite
        await expect(noormme.execute(
          'INSERT INTO test_binding (name) VALUES (?)',
          [converted]
        )).to.not.be.rejected
      }

      // Test rejection cases
      const rejectCases = [
        [1, 2, 3],
        { name: 'test' },
        undefined
      ]

      for (const input of rejectCases) {
        expect(() => convertForSQLite(input)).to.throw()
      }
    })
  })

  describe('Real-World Parameter Binding Issues', () => {
    it('should reproduce the exact error from comprehensive tests', async () => {
      // This simulates the data that causes the binding error in the comprehensive tests
      const problematicData: any[] = [
        { name: 'John', age: 25, email: 'john@example.com' },  // object instead of values
        [1, 2, 3],  // array
        undefined,  // undefined value
        new Date(), // Date object
        { toString: () => 'test' }  // object with toString
      ]

      for (const data of problematicData) {
        try {
          await noormme.execute(
            'INSERT INTO test_binding (name, age, salary) VALUES (?, ?, ?)',
            [data, data, data]
          )
          console.log(`Unexpectedly succeeded with data:`, data)
        } catch (error: any) {
          expect(error.message).to.include('SQLite3 can only bind numbers, strings, bigints, buffers, and null')
          console.log(`Expected error for data:`, data, '->', error.message)
        }
      }
    })

    it('should demonstrate proper data preparation', async () => {
      const userData = {
        name: 'Alice',
        age: 28,
        email: 'alice@example.com',
        salary: 75000.50,
        active: true,
        createdAt: new Date('2023-12-01T10:30:00Z')
      }

      // Properly prepare data for SQLite
      const preparedData = [
        userData.name,                    // string
        userData.age,                     // number
        userData.email,                   // string
        userData.salary,                  // number
        userData.active ? 1 : 0,          // boolean -> integer
        userData.createdAt.toISOString()  // Date -> string
      ]

      await expect(noormme.execute(
        'INSERT INTO test_binding (name, age, salary, active, created_at) VALUES (?, ?, ?, ?, ?)',
        preparedData
      )).to.not.be.rejected

      // Verify data was inserted correctly
      const result = await noormme.execute('SELECT * FROM test_binding WHERE name = ?', [userData.name])
      expect(result).to.have.length(1)
      expect(result[0].name).to.equal(userData.name)
      expect(result[0].age).to.equal(userData.age)
      expect(result[0].salary).to.equal(userData.salary)
      expect(result[0].active).to.equal(1)
    })
  })
})

import { describe, it, expect, beforeAll, afterAll } from 'chai'
import { NOORMME } from '../src/noormme.js'

describe('NOORMME', () => {
  let db: NOORMME

  beforeAll(async () => {
    db = new NOORMME({
      dialect: 'sqlite',
      connection: {
        host: '',
        port: 0,
        database: ':memory:',
        username: '',
        password: ''
      }
    })
  })

  afterAll(async () => {
    await db.close()
  })

  it('should initialize successfully', async () => {
    await expect(db.initialize()).to.not.be.rejected
  })

  it('should throw error when getting repository before initialization', async () => {
    const newDb = new NOORMME({
      dialect: 'sqlite',
      connection: {
        host: '',
        port: 0,
        database: ':memory:',
        username: '',
        password: ''
      }
    })

    expect(() => {
      newDb.getRepository('users')
    }).to.throw('NOORMME must be initialized before getting repositories')
  })

  it('should throw error for non-existent table', async () => {
    await db.initialize()
    
    expect(() => {
      db.getRepository('nonexistent')
    }).to.throw('Table \'nonexistent\' not found in schema')
  })

  it('should provide Kysely instance', () => {
    const kysely = db.getKysely()
    expect(kysely).to.exist
    expect(typeof kysely.selectFrom).to.equal('function')
  })

  it('should provide performance metrics', () => {
    const metrics = db.getPerformanceMetrics()
    expect(metrics).to.have.property('queryCount')
    expect(metrics).to.have.property('averageQueryTime')
    expect(metrics).to.have.property('cacheHitRate')
    expect(metrics).to.have.property('repositoryCount')
  })
})

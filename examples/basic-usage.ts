import { NOORMME } from '../src/noormme.js'

async function main() {
  // Initialize NOORMME
  const db = new NOORMME({
    dialect: 'sqlite',
    connection: {
      host: '',
      port: 0,
      database: ':memory:',
      username: '',
      password: ''
    },
    logging: {
      level: 'info',
      enabled: true
    }
  })

  try {
    // Initialize and discover schema
    await db.initialize()
    console.log('✅ NOORMME initialized successfully!')

    // Get schema information
    const schemaInfo = await db.getSchemaInfo()
    console.log(`📊 Discovered ${schemaInfo.tables.length} tables`)

    // Get performance metrics
    const metrics = db.getPerformanceMetrics()
    console.log('📈 Performance metrics:', metrics)

    // Example of using Kysely for custom queries
    const kysely = db.getKysely()
    console.log('🔧 Kysely instance available for custom queries')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    // Clean up
    await db.close()
    console.log('🔒 NOORMME closed')
  }
}

// Run the example
main().catch(console.error)

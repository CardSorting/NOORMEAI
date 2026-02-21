const { NOORMME } = require('noormme')
const { join } = require('path')

async function seedDatabase() {
  console.log('🌱 Seeding database with sample data...')
  
  const db = new NOORMME({
    dialect: 'sqlite',
    connection: {
      database: join(process.cwd(), 'data', 'app.db')
    },
    optimization: {
      enableWALMode: true,
      enableForeignKeys: true,
      cacheSize: -64000,
      synchronous: 'NORMAL'
    }
  })

  try {
    await db.initialize()
    
    const userRepo = db.getRepository('users')
    
    // Create sample users
    const sampleUsers = [
      {
        id: 'user-1',
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123', // In real app, this would be hashed
        image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=32&h=32&fit=crop&crop=face',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'user-2',
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: 'password123',
        image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=32&h=32&fit=crop&crop=face',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'user-3',
        name: 'Bob Johnson',
        email: 'bob@example.com',
        password: 'password123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ]

    for (const user of sampleUsers) {
      try {
        await userRepo.create(user)
        console.log(`✅ Created user: ${user.name} (${user.email})`)
      } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
          console.log(`⚠️  User already exists: ${user.email}`)
        } else {
          console.error(`❌ Failed to create user ${user.email}:`, error.message)
        }
      }
    }

    const userCount = await userRepo.count()
    console.log(`\n🎉 Database seeded! Total users: ${userCount}`)
    
  } catch (error) {
    console.error('❌ Database seeding failed:', error)
    process.exit(1)
  } finally {
    await db.destroy()
  }
}

seedDatabase().catch(console.error)

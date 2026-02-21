import chalk from 'chalk'
import { NOORMME } from '../../noormme.js'
import { SchemaChange } from '../../types/index.js'
import { exec } from 'child_process'
import * as os from 'os'

export async function watch(options: {
  database?: string
  interval?: string
  autoOptimize?: boolean
  autoIndex?: boolean
  notify?: boolean
}) {
  console.log(chalk.blue.bold('\n👁️ NOORMME Schema Watcher - Continuous Automation\n'))

  try {
    // Initialize NOORMME with database path
    const databasePath = options.database || process.env.DATABASE_PATH || './database.sqlite'
    const db = new NOORMME({
      dialect: 'sqlite',
      connection: { 
        database: databasePath,
        host: 'localhost',
        port: 0,
        username: '',
        password: ''
      },
      performance: {
        enableQueryOptimization: true
      }
    })
    await db.initialize()

    const intervalMs = parseInt(options.interval || '5000')
    const autoOptimize = options.autoOptimize || false
    const autoIndex = options.autoIndex || false
    const notify = options.notify || false

    console.log(chalk.gray(`📁 Database: ${databasePath}`))
    console.log(chalk.gray(`⏱️ Check interval: ${intervalMs}ms`))
    console.log(chalk.gray(`🔧 Auto-optimize: ${autoOptimize ? 'Enabled' : 'Disabled'}`))
    console.log(chalk.gray(`📊 Auto-index: ${autoIndex ? 'Enabled' : 'Disabled'}`))
    console.log(chalk.gray(`🔔 Notifications: ${notify ? 'Enabled' : 'Disabled'}`))
    console.log(chalk.yellow('\n⏳ Starting schema monitoring... (Press Ctrl+C to stop)\n'))

    let lastOptimizationTime = Date.now()
    let optimizationInterval = 60000 // Run optimization every minute if auto-optimize is enabled

    // Register schema change handler
    db.onSchemaChange(async (changes: SchemaChange[]) => {
      console.log(chalk.blue(`\n🔄 Schema changes detected at ${new Date().toLocaleTimeString()}`))
      
      console.log(chalk.yellow('📊 Changes detected:'))
      changes.forEach(change => {
        let msg = `  • ${change.type}: ${change.table}`
        if (change.column) msg += `.${change.column}`
        if (change.details) msg += ` (${JSON.stringify(change.details)})`
        console.log(chalk.gray(msg))
      })

      // Auto-optimize if enabled
      if (autoOptimize) {
        console.log(chalk.blue('🔧 Running auto-optimization...'))
        try {
          const result = await db.getSQLiteOptimizations()
          console.log(chalk.green(`✅ Generated ${result.appliedOptimizations.length} optimization recommendations`))
          if (result.warnings.length > 0) {
            console.log(chalk.yellow(`⚠️ ${result.warnings.length} warnings`))
          }
        } catch (error) {
          console.error(chalk.red('❌ Auto-optimization failed:'), error instanceof Error ? error.message : error)
        }
      }

      // Auto-index if enabled
      if (autoIndex) {
        console.log(chalk.blue('📊 Checking for index recommendations...'))
        try {
          const indexRecs = await db.getSQLiteIndexRecommendations()
          if (indexRecs.recommendations.length > 0) {
            console.log(chalk.yellow(`💡 ${indexRecs.recommendations.length} index recommendations found`))
            console.log(chalk.gray('Run optimize command to apply index recommendations'))
          }
        } catch (error) {
          console.error(chalk.red('❌ Auto-indexing failed:'), error instanceof Error ? error.message : error)
        }
      }

      // Show desktop notification if enabled
      if (notify) {
        sendNotification('NOORMME Schema Watcher', `Detected ${changes.length} changes in database`)
      }
    })

    // Start watching
    await db.startSchemaWatching({
      pollInterval: intervalMs,
      enabled: true
    })

    // Periodic tasks loop
    const periodicTaskInterval = setInterval(async () => {
      // Periodic optimization if auto-optimize is enabled
      if (autoOptimize && Date.now() - lastOptimizationTime > optimizationInterval) {
        console.log(chalk.blue(`\n🔄 Periodic optimization check at ${new Date().toLocaleTimeString()}`))
        
        try {
          const metrics = await db.getSQLitePerformanceMetrics()
          const indexRecs = await db.getSQLiteIndexRecommendations()
          
          if (indexRecs.recommendations.length > 0) {
            console.log(chalk.yellow(`💡 Found ${indexRecs.recommendations.length} new index recommendations`))
            if (autoIndex) {
              console.log(chalk.gray('Run optimize command to apply index recommendations'))
            }
          }

          // Check if optimization is needed
          if (metrics.cacheHitRate < 0.8 || metrics.averageQueryTime > 100) {
            console.log(chalk.yellow('⚠️ Performance degradation detected, running optimization...'))
            const result = await db.getSQLiteOptimizations()
            console.log(chalk.green(`✅ Generated ${result.appliedOptimizations.length} performance optimization recommendations`))
          } else {
            console.log(chalk.green('✅ Performance metrics look good'))
          }

          lastOptimizationTime = Date.now()
        } catch (error) {
          console.error(chalk.red('❌ Periodic optimization failed:'), error instanceof Error ? error.message : error)
        }
      }

      // Show periodic status
      if (Date.now() % (intervalMs * 10) < intervalMs) {
        const timestamp = new Date().toLocaleTimeString()
        try {
            const schemaInfo = await db.getSchemaInfo()
            console.log(chalk.gray(`[${timestamp}] Monitoring active - ${schemaInfo.tables.length} tables`))
        } catch (e) {
            console.log(chalk.gray(`[${timestamp}] Monitoring active`))
        }
      }
    }, intervalMs)

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log(chalk.yellow('\n⏹️ Stopping schema watcher...'))
      clearInterval(periodicTaskInterval)
      
      try {
        // Final optimization if auto-optimize is enabled
        if (autoOptimize) {
          console.log(chalk.blue('🔧 Running final optimization...'))
          const result = await db.getSQLiteOptimizations()
          console.log(chalk.green(`✅ Final optimization generated ${result.appliedOptimizations.length} recommendations`))
        }

        await db.close()
        console.log(chalk.green('✅ Schema watcher stopped successfully'))
        process.exit(0)
      } catch (error) {
        console.error(chalk.red('❌ Error during shutdown:'), error instanceof Error ? error.message : error)
        process.exit(1)
      }
    }

    // Handle process signals
    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    // Keep the process alive
    process.stdin.resume()

  } catch (error) {
    console.error(chalk.red('❌ Schema watcher failed to start:'), error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

function sendNotification(title: string, message: string) {
  const platform = os.platform()
  
  try {
    if (platform === 'darwin') {
      exec(`osascript -e 'display notification "${message}" with title "${title}"'`)
    } else if (platform === 'linux') {
      exec(`notify-send "${title}" "${message}"`)
    } else if (platform === 'win32') {
      // Windows notification using PowerShell
      const script = `
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null;
        $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02);
        $textNodes = $template.GetElementsByTagName("text");
        $textNodes.Item(0).AppendChild($template.CreateTextNode("${title}")) > $null;
        $textNodes.Item(1).AppendChild($template.CreateTextNode("${message}")) > $null;
        $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("NOORMME");
        $notification = [Windows.UI.Notifications.ToastNotification]::new($template);
        $notifier.Show($notification);
      `
      exec(`powershell -Command "${script.replace(/\n/g, '')}"`)
    }
    
    console.log(chalk.blue(`🔔 Notification sent: ${title} - ${message}`))
  } catch (error) {
    // Fail silently, just log
    console.log(chalk.gray(`(Notification failed to send: ${error})`))
  }
}

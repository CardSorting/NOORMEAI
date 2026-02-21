#!/usr/bin/env node

/**
 * NOORMME CLI Test Runner
 * 
 * This script provides a comprehensive test runner for the NOORMME CLI test suite.
 * It supports various test modes and provides detailed reporting.
 */

import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`
}

function log(message, color = 'reset') {
  console.log(colorize(message, color))
}

function logHeader(message) {
  log(`\n${'='.repeat(60)}`, 'cyan')
  log(message, 'bright')
  log('='.repeat(60), 'cyan')
}

function logSection(message) {
  log(`\n${'-'.repeat(40)}`, 'yellow')
  log(message, 'bright')
  log('-'.repeat(40), 'yellow')
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    })

    child.on('close', (code) => {
      if (code === 0) {
        resolve(code)
      } else {
        reject(new Error(`Command failed with exit code ${code}`))
      }
    })

    child.on('error', (error) => {
      reject(error)
    })
  })
}

async function checkPrerequisites() {
  logHeader('Checking Prerequisites')
  
  // Check if we're in the right directory
  const packageJsonPath = path.join(process.cwd(), 'package.json')
  if (!fs.existsSync(packageJsonPath)) {
    log('❌ package.json not found. Please run this script from the test/cli directory.', 'red')
    process.exit(1)
  }

  // Check if node_modules exists
  const nodeModulesPath = path.join(process.cwd(), 'node_modules')
  if (!fs.existsSync(nodeModulesPath)) {
    log('⚠️  node_modules not found. Installing dependencies...', 'yellow')
    try {
      await runCommand('npm', ['install'])
      log('✅ Dependencies installed successfully', 'green')
    } catch (error) {
      log('❌ Failed to install dependencies:', 'red')
      log(error.message, 'red')
      process.exit(1)
    }
  } else {
    log('✅ Dependencies found', 'green')
  }

  // Check if Jest is available
  try {
    await runCommand('npx', ['jest', '--version'])
    log('✅ Jest is available', 'green')
  } catch (error) {
    log('❌ Jest not available. Please install dependencies.', 'red')
    process.exit(1)
  }
}

async function runUnitTests() {
  logSection('Running Unit Tests')
  
  try {
    await runCommand('npm', ['run', 'test:unit'])
    log('✅ Unit tests passed', 'green')
    return true
  } catch (error) {
    log('❌ Unit tests failed', 'red')
    return false
  }
}

async function runIntegrationTests() {
  logSection('Running Integration Tests')
  
  try {
    await runCommand('npm', ['run', 'test:integration'])
    log('✅ Integration tests passed', 'green')
    return true
  } catch (error) {
    log('❌ Integration tests failed', 'red')
    return false
  }
}

async function runAllTests() {
  logSection('Running All Tests')
  
  try {
    await runCommand('npm', ['test'])
    log('✅ All tests passed', 'green')
    return true
  } catch (error) {
    log('❌ Some tests failed', 'red')
    return false
  }
}

async function runTestsWithCoverage() {
  logSection('Running Tests with Coverage')
  
  try {
    await runCommand('npm', ['run', 'test:coverage'])
    log('✅ Coverage report generated', 'green')
    return true
  } catch (error) {
    log('❌ Coverage tests failed', 'red')
    return false
  }
}

async function lintTests() {
  logSection('Linting Test Files')
  
  try {
    await runCommand('npx', ['eslint', '**/*.ts', '--ext', '.ts'])
    log('✅ Linting passed', 'green')
    return true
  } catch (error) {
    log('⚠️  Linting issues found', 'yellow')
    return false
  }
}

async function showTestSummary(results) {
  logHeader('Test Summary')
  
  const totalTests = Object.keys(results).length
  const passedTests = Object.values(results).filter(result => result === true).length
  const failedTests = totalTests - passedTests
  
  log(`Total test suites: ${totalTests}`, 'bright')
  log(`Passed: ${passedTests}`, 'green')
  log(`Failed: ${failedTests}`, failedTests > 0 ? 'red' : 'green')
  
  if (failedTests > 0) {
    log('\nFailed test suites:', 'red')
    Object.entries(results).forEach(([suite, passed]) => {
      if (!passed) {
        log(`  ❌ ${suite}`, 'red')
      }
    })
  }
  
  log('\nTest Results:', 'bright')
  Object.entries(results).forEach(([suite, passed]) => {
    const status = passed ? '✅ PASS' : '❌ FAIL'
    const color = passed ? 'green' : 'red'
    log(`  ${status} ${suite}`, color)
  })
}

async function showUsage() {
  logHeader('NOORMME CLI Test Runner')
  
  log('Usage: node run-tests.js [options]', 'bright')
  log('\nOptions:', 'bright')
  log('  --unit           Run unit tests only', 'cyan')
  log('  --integration    Run integration tests only', 'cyan')
  log('  --coverage       Run tests with coverage report', 'cyan')
  log('  --lint           Run linting on test files', 'cyan')
  log('  --all            Run all tests (default)', 'cyan')
  log('  --help           Show this help message', 'cyan')
  
  log('\nExamples:', 'bright')
  log('  node run-tests.js --unit', 'cyan')
  log('  node run-tests.js --integration', 'cyan')
  log('  node run-tests.js --coverage', 'cyan')
  log('  node run-tests.js --all --lint', 'cyan')
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args.includes('--help')) {
    await showUsage()
    return
  }
  
  try {
    await checkPrerequisites()
    
    const results = {}
    
    if (args.includes('--unit')) {
      results['Unit Tests'] = await runUnitTests()
    }
    
    if (args.includes('--integration')) {
      results['Integration Tests'] = await runIntegrationTests()
    }
    
    if (args.includes('--coverage')) {
      results['Coverage Tests'] = await runTestsWithCoverage()
    }
    
    if (args.includes('--lint')) {
      results['Linting'] = await lintTests()
    }
    
    if (args.includes('--all') || args.length === 0) {
      results['All Tests'] = await runAllTests()
    }
    
    await showTestSummary(results)
    
    const allPassed = Object.values(results).every(result => result === true)
    if (allPassed) {
      log('\n🎉 All tests completed successfully!', 'green')
      process.exit(0)
    } else {
      log('\n💥 Some tests failed. Please check the output above.', 'red')
      process.exit(1)
    }
    
  } catch (error) {
    log(`\n❌ Test runner failed: ${error.message}`, 'red')
    process.exit(1)
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`\n❌ Uncaught exception: ${error.message}`, 'red')
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  log(`\n❌ Unhandled rejection at: ${promise}, reason: ${reason}`, 'red')
  process.exit(1)
})

// Run the main function
main().catch(error => {
  log(`\n❌ Fatal error: ${error.message}`, 'red')
  process.exit(1)
})

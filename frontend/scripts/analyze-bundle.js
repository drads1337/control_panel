#!/usr/bin/env node

/**
 * Скрипт для анализа размера bundle
 * Выполняет сборку и анализ размеров chunks, дублирующихся зависимостей
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

/**
 * Анализирует stats.html из rollup-plugin-visualizer
 */
function analyzeBundleStats() {
  const statsPath = join(projectRoot, 'dist', 'stats.html')

  try {
    const statsContent = readFileSync(statsPath, 'utf-8')
    console.log('✅ Bundle stats file found at:', statsPath)
    console.log('📊 Open dist/stats.html in your browser for detailed visualization\n')
  } catch (error) {
    console.error('❌ Bundle stats file not found. Run "npm run build:analyze" first.')
    process.exit(1)
  }
}

/**
 * Анализирует размеры файлов в dist
 */
function analyzeDistSizes() {
  const distPath = join(projectRoot, 'dist')

  try {
    const files = readdirSync(distPath, { recursive: true })
    const jsFiles = files
      .filter((file) => file.endsWith('.js'))
      .map((file) => {
        const filePath = join(distPath, file)
        const stats = statSync(filePath)
        return {
          name: file,
          size: stats.size,
          sizeKB: (stats.size / 1024).toFixed(2),
          sizeMB: (stats.size / (1024 * 1024)).toFixed(2),
        }
      })
      .sort((a, b) => b.size - a.size)

    console.log('📦 Bundle sizes:\n')
    console.log('File'.padEnd(60), 'Size (KB)'.padEnd(15), 'Size (MB)')
    console.log('-'.repeat(90))

    let totalSize = 0
    jsFiles.forEach((file) => {
      totalSize += file.size
      console.log(
        file.name.padEnd(60),
        file.sizeKB.padEnd(15),
        file.sizeMB
      )
    })

    console.log('-'.repeat(90))
    console.log(
      'TOTAL'.padEnd(60),
      (totalSize / 1024).toFixed(2).padEnd(15),
      (totalSize / (1024 * 1024)).toFixed(2)
    )

    // Целевые значения
    const totalMB = totalSize / (1024 * 1024)
    const initialChunk = jsFiles[0]?.size || 0
    const initialMB = initialChunk / (1024 * 1024)

    console.log('\n🎯 Target metrics:')
    console.log(`Total bundle size: ${totalMB.toFixed(2)} MB (target: < 1 MB) ${totalMB < 1 ? '✅' : '❌'}`)
    console.log(`Initial chunk size: ${initialMB.toFixed(2)} MB (target: < 300 KB) ${initialMB < 0.3 ? '✅' : '❌'}`)
    console.log(`Largest chunk: ${(jsFiles[0]?.size || 0) / (1024 * 1024)} MB (target: < 200 KB) ${(jsFiles[0]?.size || 0) < 200 * 1024 ? '✅' : '❌'}`)

    return { jsFiles, totalSize }
  } catch (error) {
    console.error('❌ Error reading dist directory:', error.message)
    process.exit(1)
  }
}

/**
 * Проверяет дублирующиеся зависимости
 */
function checkDuplicateDependencies() {
  console.log('\n🔍 Checking for duplicate dependencies...')
  console.log('Note: This requires manual review of stats.html\n')
  console.log('Look for packages that appear in multiple chunks')
  console.log('Common offenders:')
  console.log('  - React/React-DOM')
  console.log('  - Lodash')
  console.log('  - Date libraries (date-fns, moment)')
  console.log('  - UI libraries (@radix-ui, @mui)\n')
}

/**
 * Выполняет сборку и анализ
 */
function main() {
  console.log('🚀 Starting bundle analysis...\n')

  // Проверяем, был ли выполнен build:analyze
  try {
    execSync('npm run build:analyze', { cwd: projectRoot, stdio: 'inherit' })
  } catch (error) {
    console.error('❌ Build failed:', error.message)
    process.exit(1)
  }

  console.log('\n')
  analyzeBundleStats()
  const { jsFiles } = analyzeDistSizes()
  checkDuplicateDependencies()

  // Рекомендации
  console.log('\n💡 Recommendations:')
  const totalMB = jsFiles.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024)
  const largestChunk = jsFiles[0]?.size || 0

  if (totalMB > 1) {
    console.log('  - Consider code splitting large chunks')
    console.log('  - Review lazy loading imports')
    console.log('  - Check for unused dependencies')
  }

  if (largestChunk > 200 * 1024) {
    console.log('  - Largest chunk is too large, consider splitting')
    console.log('  - Move heavy dependencies to separate chunks')
  }

  if (jsFiles.length > 20) {
    console.log('  - Too many chunks, consider consolidating')
  }

  console.log('\n✅ Analysis complete!')
}

main()


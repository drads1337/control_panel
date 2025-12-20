#!/usr/bin/env node

/**
 * Скрипт для проверки безопасности кода
 * Проверяет:
 * 1. Наличие импортов из дублирующихся директорий (frontend_copy_*, backend_copy)
 * 2. Использование PII в URL параметрах (предупреждения)
 * 3. Наличие предупреждающих комментариев SECURITY WARNING
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const PROJECT_ROOT = path.resolve(__dirname, '..')
const FRONTEND_SRC = path.join(PROJECT_ROOT, 'frontend', 'src')
const BACKEND_SRC = path.join(PROJECT_ROOT, 'backend')

const ISSUES = {
  imports: [],
  missingWarnings: [],
  info: []
}

/**
 * Рекурсивно находит все файлы с указанными расширениями
 */
function findFiles(dir, extensions, fileList = []) {
  if (!fs.existsSync(dir)) {
    return fileList
  }

  const files = fs.readdirSync(dir)

  files.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      // Пропускаем node_modules, dist, build и другие служебные директории
      if (!['node_modules', 'dist', 'build', '.git', '.next', 'out'].includes(file)) {
        findFiles(filePath, extensions, fileList)
      }
    } else {
      const ext = path.extname(file)
      if (extensions.includes(ext)) {
        fileList.push(filePath)
      }
    }
  })

  return fileList
}

/**
 * Проверяет файл на импорты из дублирующихся директорий
 */
function checkImports(filePath, content) {
  const lines = content.split('\n')
  const relativePath = path.relative(PROJECT_ROOT, filePath)

  lines.forEach((line, index) => {
    // Проверяем импорты из frontend_copy_* или backend_copy
    // Исключаем ложные срабатывания на слова типа "copy", "clipboard" и т.д.
    const copyDirPattern = /(frontend_copy|backend_copy)/
    const importPattern = /(from|import)\s+['"].*(frontend_copy|backend_copy)/
    
    // Проверяем только если это действительно импорт из дублирующихся директорий
    if (
      (copyDirPattern.test(line) && importPattern.test(line)) ||
      /from\s+['"]\.\.?\/.*(frontend_copy|backend_copy)/.test(line) ||
      /import\s+.*from\s+['"]\.\.?\/.*(frontend_copy|backend_copy)/.test(line)
    ) {
      ISSUES.imports.push({
        file: relativePath,
        line: index + 1,
        content: line.trim()
      })
    }
  })
}

/**
 * Проверяет API файлы на наличие предупреждений о PII
 */
function checkPIIWarnings(filePath, content) {
  const relativePath = path.relative(PROJECT_ROOT, filePath)
  const isApiFile = /\/api\/.*\.(ts|tsx|js|jsx)$/.test(filePath)
  
  if (!isApiFile) {
    return
  }

  // Список функций, которые могут передавать PII в URL
  // Проверяем только экспортируемые функции (export async function или export function)
  const piiFunctions = [
    'getLogs',
    'searchLogs',
    'getUsers',
    'getLicenseKeys',
    'exportLogs',
    'getConnectionLogs'
  ]

  // Проверяем, что функция действительно экспортируется и принимает параметры с PII
  const hasPIIFunction = piiFunctions.some(func => {
    const functionPattern = new RegExp(`export\\s+(async\\s+)?function\\s+${func}`, 'i')
    return functionPattern.test(content)
  })
  
  const hasSecurityWarning = content.includes('SECURITY WARNING') || 
                            content.includes('SECURITY:') ||
                            content.includes('PII') ||
                            content.includes('Personally Identifiable Information')

  if (hasPIIFunction && !hasSecurityWarning) {
    ISSUES.missingWarnings.push({
      file: relativePath,
      reason: 'Contains PII-related functions but no security warning'
    })
  }
}

/**
 * Основная функция проверки
 */
function checkSecurity() {
  console.log('🔍 Проверка безопасности кода...\n')

  // Проверяем фронтенд
  if (fs.existsSync(FRONTEND_SRC)) {
    console.log('📱 Проверка фронтенда...')
    const frontendFiles = findFiles(FRONTEND_SRC, ['.ts', '.tsx', '.js', '.jsx'])
    
    frontendFiles.forEach(filePath => {
      const content = fs.readFileSync(filePath, 'utf-8')
      checkImports(filePath, content)
      checkPIIWarnings(filePath, content)
    })
    
    console.log(`   Проверено файлов: ${frontendFiles.length}`)
  }

  // Проверяем бэкенд
  if (fs.existsSync(BACKEND_SRC)) {
    console.log('🔧 Проверка бэкенда...')
    const backendFiles = findFiles(BACKEND_SRC, ['.py'])
    
    backendFiles.forEach(filePath => {
      const content = fs.readFileSync(filePath, 'utf-8')
      checkImports(filePath, content)
    })
    
    console.log(`   Проверено файлов: ${backendFiles.length}`)
  }

  // Выводим результаты
  console.log('\n📊 Результаты проверки:\n')

  if (ISSUES.imports.length > 0) {
    console.log('❌ Найдены импорты из дублирующихся директорий:')
    ISSUES.imports.forEach(issue => {
      console.log(`   ${issue.file}:${issue.line}`)
      console.log(`   ${issue.content}\n`)
    })
  } else {
    console.log('✅ Импорты из дублирующихся директорий не найдены')
  }

  console.log('')

  if (ISSUES.missingWarnings.length > 0) {
    console.log('⚠️  Файлы без предупреждений о безопасности:')
    ISSUES.missingWarnings.forEach(issue => {
      console.log(`   ${issue.file}`)
      console.log(`   Причина: ${issue.reason}\n`)
    })
  } else {
    console.log('✅ Все API файлы с PII содержат предупреждения')
  }

  // Итоговый статус
  console.log('\n' + '='.repeat(50))
  const totalIssues = ISSUES.imports.length + ISSUES.missingWarnings.length
  
  if (totalIssues === 0) {
    console.log('✅ Проверка безопасности пройдена успешно!')
    process.exit(0)
  } else {
    console.log(`❌ Найдено проблем: ${totalIssues}`)
    console.log(`   - Импорты из дублирующихся директорий: ${ISSUES.imports.length}`)
    console.log(`   - Отсутствующие предупреждения: ${ISSUES.missingWarnings.length}`)
    process.exit(1)
  }
}

// Запускаем проверку
checkSecurity()


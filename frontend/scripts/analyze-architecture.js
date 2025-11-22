#!/usr/bin/env node

/**
 * Скрипт для анализа архитектуры frontend проекта
 * 
 * Проверяет:
 * - Circular dependencies
 * - Barrel files (index.ts)
 * - Размер компонентов
 * - Структуру проекта
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SRC_DIR = path.join(__dirname, '../src');
const MAX_COMPONENT_LINES = 300;
const MAX_FUNCTION_LINES = 50;

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 1. Найти все barrel files (index.ts)
function findBarrelFiles(dir = SRC_DIR, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      findBarrelFiles(fullPath, files);
    } else if (entry.isFile() && entry.name === 'index.ts' || entry.name === 'index.tsx') {
      files.push(fullPath);
    }
  }
  
  return files;
}

// 2. Найти большие компоненты
function findLargeComponents(dir = SRC_DIR, components = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      findLargeComponents(fullPath, components);
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n').length;
      
      if (lines > MAX_COMPONENT_LINES) {
        components.push({
          path: fullPath.replace(SRC_DIR, ''),
          lines,
          size: '🔴',
        });
      } else if (lines > 200) {
        components.push({
          path: fullPath.replace(SRC_DIR, ''),
          lines,
          size: '🟡',
        });
      }
    }
  }
  
  return components.sort((a, b) => b.lines - a.lines);
}

// 3. Найти большие функции
function findLargeFunctions(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const functions = [];
  
  let currentFunction = null;
  let braceCount = 0;
  let functionStart = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Простая проверка на начало функции
    if (line.match(/(function|const|export\s+(function|const))\s+\w+.*=>/)) {
      currentFunction = line.trim();
      functionStart = i;
      braceCount = 0;
    }
    
    if (currentFunction) {
      braceCount += (line.match(/{/g) || []).length;
      braceCount -= (line.match(/}/g) || []).length;
      
      if (braceCount === 0 && i > functionStart) {
        const functionLines = i - functionStart + 1;
        if (functionLines > MAX_FUNCTION_LINES) {
          functions.push({
            name: currentFunction.substring(0, 50),
            lines: functionLines,
            start: functionStart + 1,
          });
        }
        currentFunction = null;
      }
    }
  }
  
  return functions;
}

// 4. Проверить circular dependencies (требует madge)
function checkCircularDependencies() {
  try {
    const result = execSync('npx madge --circular src/', { 
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe'
    });
    
    if (result.includes('No circular dependencies found')) {
      return { found: false, details: [] };
    }
    
    const matches = result.match(/Found (\d+) circular dependenc(?:y|ies)/);
    const count = matches ? parseInt(matches[1]) : 0;
    
    return { found: count > 0, count, details: result };
  } catch (error) {
    if (error.message.includes('command not found') || error.message.includes('Cannot find module')) {
      return { found: null, error: 'madge not installed. Run: npm install -D madge' };
    }
    return { found: null, error: error.message };
  }
}

// 5. Анализ структуры проекта
function analyzeProjectStructure() {
  const structure = {
    app: { files: 0, components: 0, pages: 0 },
    entities: { files: 0, components: 0 },
    features: { files: 0, components: 0 },
    shared: { files: 0, components: 0 },
    components: { files: 0, components: 0 },
  };
  
  function analyzeDir(dir, layer) {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        analyzeDir(fullPath, layer);
      } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
        structure[layer].files++;
        if (entry.name.endsWith('.tsx')) {
          structure[layer].components++;
        }
      }
    }
  }
  
  Object.keys(structure).forEach(layer => {
    const layerPath = path.join(SRC_DIR, layer);
    if (fs.existsSync(layerPath)) {
      analyzeDir(layerPath, layer);
    }
  });
  
  return structure;
}

// Главная функция
function main() {
  log('\n📊 Архитектурный анализ Frontend проекта\n', 'cyan');
  
  // 1. Barrel files
  log('\n1️⃣  Анализ Barrel Files (index.ts)...', 'blue');
  const barrelFiles = findBarrelFiles();
  log(`   Найдено: ${barrelFiles.length} barrel files`, barrelFiles.length > 20 ? 'yellow' : 'green');
  
  if (barrelFiles.length > 0) {
    log('\n   Примеры:', 'yellow');
    barrelFiles.slice(0, 10).forEach(file => {
      log(`   - ${file.replace(SRC_DIR, '')}`, 'reset');
    });
    if (barrelFiles.length > 10) {
      log(`   ... и еще ${barrelFiles.length - 10} файлов`, 'reset');
    }
  }
  
  // 2. Большие компоненты
  log('\n2️⃣  Поиск больших компонентов (>300 строк)...', 'blue');
  const largeComponents = findLargeComponents();
  
  if (largeComponents.length === 0) {
    log('   ✅ Все компоненты в пределах нормы', 'green');
  } else {
    log(`   ⚠️  Найдено ${largeComponents.length} больших компонентов:`, 'yellow');
    largeComponents.forEach(comp => {
      log(`   ${comp.size} ${comp.path} (${comp.lines} строк)`, 'reset');
    });
  }
  
  // 3. Circular dependencies
  log('\n3️⃣  Проверка Circular Dependencies...', 'blue');
  const circular = checkCircularDependencies();
  
  if (circular.found === null) {
    log(`   ⚠️  ${circular.error}`, 'yellow');
  } else if (circular.found) {
    log(`   🔴 Найдено ${circular.count} circular dependencies!`, 'red');
    log('   Запустите: npx madge --circular src/ для деталей', 'yellow');
  } else {
    log('   ✅ Circular dependencies не найдены', 'green');
  }
  
  // 4. Структура проекта
  log('\n4️⃣  Анализ структуры проекта...', 'blue');
  const structure = analyzeProjectStructure();
  
  Object.entries(structure).forEach(([layer, stats]) => {
    if (stats.files > 0) {
      log(`   ${layer}: ${stats.files} файлов, ${stats.components} компонентов`, 'reset');
    }
  });
  
  // 5. Рекомендации
  log('\n5️⃣  Рекомендации:', 'blue');
  
  const recommendations = [];
  
  if (barrelFiles.length > 20) {
    recommendations.push('🔴 Уменьшить количество barrel files (сейчас: ' + barrelFiles.length + ')');
  }
  
  if (largeComponents.length > 0) {
    recommendations.push(`🔴 Рефакторинг больших компонентов (${largeComponents.length} найдено)`);
  }
  
  if (circular.found) {
    recommendations.push('🔴 Исправить circular dependencies');
  }
  
  if (!fs.existsSync(path.join(SRC_DIR, 'features'))) {
    recommendations.push('🟡 Создать слой features/ для бизнес-логики');
  }
  
  if (recommendations.length === 0) {
    log('   ✅ Все в порядке!', 'green');
  } else {
    recommendations.forEach(rec => log(`   ${rec}`, 'yellow'));
  }
  
  // Итоговая статистика
  log('\n📈 Итоговая статистика:', 'cyan');
  log(`   Barrel files: ${barrelFiles.length}`, barrelFiles.length > 20 ? 'yellow' : 'green');
  log(`   Больших компонентов: ${largeComponents.length}`, largeComponents.length > 0 ? 'yellow' : 'green');
  log(`   Circular dependencies: ${circular.found === null ? 'не проверено' : circular.found ? 'найдены' : 'нет'}`, 
      circular.found ? 'red' : 'green');
  
  log('\n');
}

// Запуск
main();

export { findBarrelFiles, findLargeComponents, checkCircularDependencies };


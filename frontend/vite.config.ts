import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import fs from 'fs'

// Plugin to ensure TypeScript files are resolved correctly
const resolveTypeScriptFiles = () => {
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.json']
  
  const tryResolveFile = (basePath: string): string | null => {
    const normalizedBasePath = path.normalize(basePath)
    
    // Try direct file with extensions
    for (const ext of extensions) {
      const fullPath = normalizedBasePath + ext
      try {
        if (fs.existsSync(fullPath)) {
          const stats = fs.statSync(fullPath)
          if (stats.isFile()) {
            return fullPath
          }
        }
      } catch {
        // File doesn't exist, continue
      }
    }
    
    // Try index files in the directory
    for (const ext of extensions) {
      const indexPath = path.join(normalizedBasePath, 'index' + ext)
      try {
        if (fs.existsSync(indexPath)) {
          const stats = fs.statSync(indexPath)
          if (stats.isFile()) {
            return indexPath
          }
        }
      } catch {
        // File doesn't exist, continue
      }
    }
    
    // If basePath is a directory, try index files inside
    try {
      if (fs.existsSync(normalizedBasePath)) {
        const stats = fs.statSync(normalizedBasePath)
        if (stats.isDirectory()) {
          for (const ext of extensions) {
            const indexPath = path.join(normalizedBasePath, 'index' + ext)
            try {
              if (fs.existsSync(indexPath)) {
                const fileStats = fs.statSync(indexPath)
                if (fileStats.isFile()) {
                  return indexPath
                }
              }
            } catch {
              // File doesn't exist, continue
            }
          }
        }
      }
    } catch {
      // Path doesn't exist, continue
    }
    
    return null
  }
  
  return {
    name: 'resolve-typescript-files',
    enforce: 'pre' as const, // Run before other plugins
    resolveId(id: string, importer?: string) {
      // Skip node_modules, virtual modules, and already resolved paths
      if (id.startsWith('\0') || id.includes('node_modules') || id.startsWith('data:') || id.startsWith('http')) {
        return null
      }
      
      // Skip if already has extension and is not an alias
      if (id.match(/\.[^/]+$/) && !id.startsWith('@/')) {
        return null
      }
      
      let basePath: string | null = null
      
      // Handle absolute paths (like /app/src/lib/utils)
      if (path.isAbsolute(id)) {
        // Check if it's a path in our src directory
        if (id.includes('/src/')) {
          const srcIndex = id.indexOf('/src/')
          if (srcIndex !== -1) {
            const relativePath = id.substring(srcIndex + '/src/'.length)
            basePath = path.resolve(__dirname, './src', relativePath)
          }
        }
      } else if (id.startsWith('@/')) {
        // Handle @ alias - resolve relative to src directory
        const aliasPath = id.replace('@/', '')
        // Normalize path separators for cross-platform compatibility
        const normalizedPath = aliasPath.replace(/\\/g, '/')
        basePath = path.resolve(__dirname, './src', normalizedPath)
      } else if (id.startsWith('./') || id.startsWith('../')) {
        // Handle relative imports
        if (importer) {
          basePath = path.resolve(path.dirname(importer), id)
        }
      } else if (!id.includes(':')) {
        // Handle bare imports (without ./ or ../)
        // Try resolving from src directory
        basePath = path.resolve(__dirname, './src', id)
      }
      
      if (basePath) {
        return tryResolveFile(basePath)
      }
      
      return null
    },
    load(id: string) {
      // Handle cases where resolveId didn't catch it
      // This happens when vite:load-fallback tries to load the file
      // Check if it's a path without extension that should be resolved
      if (!id.match(/\.[^/]+$/) && !id.includes('node_modules') && !id.startsWith('\0')) {
        let basePath: string | null = null
        
        // Handle absolute paths like /app/src/lib/utils
        if (id.startsWith('/app/src/') || id.includes('/src/')) {
          const srcIndex = id.indexOf('/src/')
          if (srcIndex !== -1) {
            const relativePath = id.substring(srcIndex + '/src/'.length)
            basePath = path.resolve(__dirname, './src', relativePath)
          }
        }
        // Handle @ alias paths
        else if (id.includes('@/')) {
          const aliasPath = id.replace(/.*@\//, '')
          basePath = path.resolve(__dirname, './src', aliasPath)
        }
        
        if (basePath) {
          const resolved = tryResolveFile(basePath)
          if (resolved && fs.existsSync(resolved)) {
            return fs.readFileSync(resolved, 'utf-8')
          }
        }
      }
      return null
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isAnalyze = mode === 'analyze'
  
  return {
    plugins: [
      resolveTypeScriptFiles(),
      react({
        // Ensure proper TypeScript file resolution
        include: '**/*.{jsx,tsx}',
      }),
      // Bundle visualizer - only enable in analyze mode
      isAnalyze && visualizer({
        open: true,
        filename: './dist/stats.html',
        gzipSize: true,
        brotliSize: true,
      }),
    ].filter(Boolean),
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: ['zolo-cn.store', 'www.zolo-cn.store', 'localhost', '127.0.0.1', '192.168.1.7', '192.168.1.30'],
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:5001',
          changeOrigin: true,
          secure: false,
          ws: true, // Enable websocket proxying
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              // Forward cookies explicitly
              if (req.headers.cookie) {
                proxyReq.setHeader('Cookie', req.headers.cookie);
              }
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              // Forward Set-Cookie headers from backend
              const setCookieHeaders = proxyRes.headers['set-cookie'];
              if (setCookieHeaders) {
                // Update cookie domain/path if needed for proxy
                proxyRes.headers['set-cookie'] = setCookieHeaders.map(cookie => {
                  // Remove domain restriction if present to allow cookies on proxy
                  return cookie
                    .replace(/;\s*domain=[^;]+/gi, '')
                    .replace(/;\s*Secure/gi, ''); // Remove Secure flag in dev
                });
              }
            });
          },
        },
        '/uploads': {
          target: 'http://127.0.0.1:5001',
          changeOrigin: true,
          secure: false,
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              // Forward cookies explicitly for authenticated file access
              if (req.headers.cookie) {
                proxyReq.setHeader('Cookie', req.headers.cookie);
              }
            });
          },
        },
      },
      hmr: {
        overlay: false,
      },
    },
    define: {
      // Force browser environment for axios
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
      'process.browser': true,
      'global': 'globalThis',
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        // Polyfill Node.js modules for browser (only if needed)
        "stream": "stream-browserify",
        "util": "util",
        "crypto": "crypto-browserify",
        "path": "path-browserify",
        "os": "os-browserify/browser",
        "http": "stream-http",
        "https": "https-browserify",
        "zlib": "browserify-zlib",
        "tty": "tty-browserify",
        "assert": "assert",
        "events": "events",
      },
      // Explicitly set extensions to ensure TypeScript files are resolved
      // Order matters: TypeScript files first for better resolution
      extensions: ['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs', '.json'],
      // Ensure proper handling of CommonJS modules like lodash
      // Dedupe React to prevent multiple instances and bundling issues
      dedupe: ['react', 'react-dom', 'lodash'],
      // Fix react-map-gl v8 package resolution issue
      conditions: ['import', 'module', 'browser', 'default'],
      // Fix react-map-gl package exports resolution
      mainFields: ['module', 'main'],
      // Ensure proper file resolution in production builds
      preserveSymlinks: false,
    },
    build: {
      // Use modern ES2020 target for better tree-shaking and smaller bundles
      // Modern browsers support ES2020, allowing better optimization
      target: isAnalyze ? 'es2015' : 'es2020',
      // Use terser for better minification and smaller bundle sizes
      // Terser produces smaller bundles than esbuild, which is important for Lighthouse scores
      minify: isAnalyze ? false : 'terser',
      // Terser minification options for maximum compression
      terserOptions: isAnalyze ? undefined : {
        compress: {
          drop_console: true, // Remove console statements
          drop_debugger: true, // Remove debugger statements
          pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn', 'console.error'], // Remove all console methods
          passes: 3, // More passes for better compression
          unsafe: true, // Enable unsafe optimizations for smaller bundles
          unsafe_comps: true,
          unsafe_math: true,
          unsafe_methods: true,
          unsafe_proto: true,
          unsafe_regexp: true,
          unsafe_undefined: true,
          dead_code: true, // Remove dead code
          evaluate: true, // Evaluate constant expressions
          reduce_vars: true, // Reduce variable usage
          collapse_vars: true, // Collapse variables
          unused: true, // Remove unused code
          side_effects: false, // Assume no side effects for better optimization
        },
        format: {
          comments: false, // Remove all comments
          ascii_only: false, // Allow non-ASCII characters for smaller output
        },
        mangle: {
          safari10: true, // Fix Safari 10 issues
          properties: false, // Don't mangle properties to avoid breaking code
        },
        ecma: 2020, // Target ES2020
      },
      // esbuild options for non-minified builds
      esbuild: isAnalyze ? undefined : {
        legalComments: 'none', // Remove all comments
        drop: ['console', 'debugger'], // Remove console and debugger statements
        minifyIdentifiers: true,
        minifySyntax: true,
        minifyWhitespace: true,
        treeShaking: true, // Enable tree-shaking
      },
      sourcemap: isAnalyze ? true : false,
      // Optimization for production: reduce bundle size
      cssCodeSplit: true, // Split CSS for better caching
      cssMinify: true, // Minify CSS
      reportCompressedSize: false, // Speeds up build
      // Enable tree-shaking and dead code elimination
      rollupOptions: {
        // Handle Node.js modules that shouldn't be bundled
        plugins: [],
        output: {
          // Define globals for Node.js modules that are externalized
          globals: {},
          // Improved code splitting for better loading
          manualChunks: (id) => {
            // Vendor chunks - main libraries
            if (id.includes('node_modules')) {
              // React core - DO NOT split React/React-DOM into separate chunk
              // They must be in the main entry chunk to avoid race conditions
              // where code tries to use React before it's loaded
              // Match exact package names to avoid matching react-router, react-query, etc.
              if (id.includes('/react/') || id.includes('/react-dom/') || 
                  id.includes('\\react\\') || id.includes('\\react-dom\\')) {
                return undefined // Return undefined to keep React in the main entry chunk
              }
              // Router - needed early
              if (id.includes('react-router')) {
                return 'vendor-router'
              }
              // Radix UI - large library, split by usage
              if (id.includes('@radix-ui')) {
                // Split Radix into smaller chunks by component
                const radixMatch = id.match(/@radix-ui\/([^/]+)/)
                if (radixMatch) {
                  const component = radixMatch[1]
                  // Group frequently used components together
                  if (['dialog', 'dropdown-menu', 'select', 'popover'].includes(component)) {
                    return 'vendor-radix-core'
                  }
                  if (['toast', 'tooltip', 'hover-card'].includes(component)) {
                    return 'vendor-radix-overlay'
                  }
                  return 'vendor-radix-other'
                }
                return 'vendor-radix'
              }
              // Material UI - large, split it
              if (id.includes('@mui')) {
                return 'vendor-mui'
              }
              // TanStack (React Query, Table) - split by package
              if (id.includes('@tanstack')) {
                if (id.includes('react-query')) {
                  return 'vendor-tanstack-query'
                }
                if (id.includes('react-table')) {
                  return 'vendor-tanstack-table'
                }
                return 'vendor-tanstack-other'
              }
              // Charts - heavy libraries, lazy load
              if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
                return 'vendor-chartjs'
              }
              if (id.includes('recharts')) {
                return 'vendor-recharts'
              }
              // Forms - split by library
              if (id.includes('react-hook-form') || id.includes('@hookform')) {
                return 'vendor-forms-hook'
              }
              if (id.includes('zod') || id.includes('yup')) {
                return 'vendor-forms-validation'
              }
              // Animation libraries - heavy, lazy load
              if (id.includes('framer-motion') || id.includes('motion')) {
                return 'vendor-animation'
              }
              // Icons - can be large, split by library for better tree-shaking
              if (id.includes('lucide-react')) {
                // Lucide icons are tree-shakeable, but still split to reduce initial bundle
                // Named imports ensure tree-shaking works correctly
                return 'vendor-icons-lucide'
              }
              // Utils - small, can be in one chunk
              if (id.includes('clsx') || id.includes('class-variance-authority') || id.includes('tailwind-merge')) {
                return 'vendor-utils'
              }
              // Sentry - load separately
              if (id.includes('@sentry')) {
                return 'vendor-sentry'
              }
              // Other node_modules - split large ones
              if (id.includes('lodash')) {
                return 'vendor-lodash'
              }
              if (id.includes('axios')) {
                return 'vendor-axios'
              }
              // Default vendor chunk for smaller dependencies
              return 'vendor'
            }
          },
          // Optimize file names for caching
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
          // Better tree-shaking and dead code elimination
          generatedCode: {
            constBindings: true, // Use const instead of var for better tree-shaking
            preset: 'es2015', // Use ES2015 preset for better compatibility
          },
          // Optimize chunk loading
          compact: true, // Compact output for smaller files
        },
        // External dependencies that shouldn't be bundled (if using CDN)
        // external: [], // Add any external deps here if using CDN
      },
      // Enable better tree-shaking
      commonjsOptions: {
        include: [/lodash/, /node_modules/],
        transformMixedEsModules: true,
      },
      // Additional optimizations for smaller bundles
      assetsInlineLimit: 4096, // Inline small assets (<4KB) as base64 to reduce HTTP requests
      // Reduce bundle size by optimizing module resolution
      modulePreload: {
        polyfill: false, // Disable module preload polyfill to reduce bundle size
      },
      // Improve chunk size limits - reduced for better performance
      chunkSizeWarningLimit: 500, // Warn about chunks larger than 500KB
    },
      optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'lodash',
        'lodash/get',
        'lodash/isNaN', // Fix recharts lodash import issue
        'recharts', // Pre-bundle recharts to fix lodash compatibility
        'react-map-gl/mapbox',
        'mapbox-gl',
        'axios', // Pre-bundle axios to fix Node.js module issues
      ],
      // Exclude heavy dependencies from pre-bundling to reduce initial load
      exclude: [
        '@tanstack/react-table', 
        'chart.js',
        'framer-motion', // Lazy load animations
        'ogl', // Lazy load 3D library (used in FaultyTerminal)
      ],
      // Force optimization of specific packages
      // Handle CommonJS default exports (fixes lodash/get import issues)
      // Also handles react-map-gl which doesn't have a root export
      esbuildOptions: {
        target: 'es2020',
        mainFields: ['module', 'main'],
        // Transform CommonJS default exports to named exports for lodash
        // This fixes recharts compatibility with lodash
        plugins: [],
        // Fix lodash CommonJS imports for recharts
        format: 'esm',
      },
      // Fix lodash imports for recharts compatibility
      resolve: {
        alias: {
          // Ensure lodash modules work with ES modules
          'lodash/isNaN': 'lodash-es/isNaN',
          'lodash/isString': 'lodash-es/isString',
        },
        conditions: ['import', 'module', 'browser', 'default'],
        // Fix react-map-gl package exports resolution in optimizeDeps
        mainFields: ['module', 'main'],
        // Handle packages without root exports (like react-map-gl v8)
        extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
      },
    },
  }
})
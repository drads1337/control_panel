import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  clearSensitiveParamsFromUrl,
  hasSensitiveParamsInUrl,
  createSafeUrl,
  clearDefaultSensitiveParamsFromUrl,
  DEFAULT_SENSITIVE_PARAMS,
} from '../url-security'

describe('URL Security Utilities', () => {
  let originalLocation: Location
  let originalHistory: History

  beforeEach(() => {
    // Save original globals
    originalLocation = window.location
    originalHistory = window.history

    // Mock window.location
    delete (window as any).location
    window.location = {
      ...originalLocation,
      href: 'https://example.com/page?username=test&page=1',
      search: '?username=test&page=1',
    } as Location

    // Mock window.history.replaceState
    window.history.replaceState = vi.fn()
    window.history.pushState = vi.fn()
  })

  afterEach(() => {
    // Restore original globals
    window.location = originalLocation
    window.history = originalHistory
    vi.restoreAllMocks()
  })

  describe('clearSensitiveParamsFromUrl', () => {
    it('should remove sensitive parameters from URL', () => {
      window.location.href = 'https://example.com/page?username=test&search=query&page=1'
      window.location.search = '?username=test&search=query&page=1'

      clearSensitiveParamsFromUrl(['username', 'search'])

      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        'https://example.com/page?page=1'
      )
    })

    it('should keep non-sensitive parameters', () => {
      window.location.href = 'https://example.com/page?page=1&per_page=20'
      window.location.search = '?page=1&per_page=20'

      clearSensitiveParamsFromUrl(['username', 'search'])

      expect(window.history.replaceState).toHaveBeenCalledWith(
        {},
        '',
        'https://example.com/page?page=1&per_page=20'
      )
    })

    it('should handle empty sensitive params array', () => {
      window.location.href = 'https://example.com/page?username=test'
      window.location.search = '?username=test'

      clearSensitiveParamsFromUrl([])

      // Should not call replaceState if no changes
      expect(window.history.replaceState).not.toHaveBeenCalled()
    })

    it('should work in non-browser environment', () => {
      const originalWindow = global.window
      delete (global as any).window

      // Should not throw
      clearSensitiveParamsFromUrl(['username'])

      global.window = originalWindow
    })
  })

  describe('hasSensitiveParamsInUrl', () => {
    it('should return true if URL contains sensitive parameters', () => {
      window.location.href = 'https://example.com/page?username=test'
      window.location.search = '?username=test'

      expect(hasSensitiveParamsInUrl(['username'])).toBe(true)
    })

    it('should return false if URL does not contain sensitive parameters', () => {
      window.location.href = 'https://example.com/page?page=1'
      window.location.search = '?page=1'

      expect(hasSensitiveParamsInUrl(['username', 'search'])).toBe(false)
    })

    it('should work in non-browser environment', () => {
      const originalWindow = global.window
      delete (global as any).window

      expect(hasSensitiveParamsInUrl(['username'])).toBe(false)

      global.window = originalWindow
    })
  })

  describe('createSafeUrl', () => {
    it('should create URL without sensitive parameters', () => {
      const url = new URL('https://example.com/page?username=test&page=1&search=query')
      const safeUrl = createSafeUrl(url, ['username', 'search'])

      expect(safeUrl.searchParams.has('username')).toBe(false)
      expect(safeUrl.searchParams.has('search')).toBe(false)
      expect(safeUrl.searchParams.has('page')).toBe(true)
      expect(safeUrl.searchParams.get('page')).toBe('1')
    })
  })

  describe('clearDefaultSensitiveParamsFromUrl', () => {
    it('should clear all default sensitive parameters', () => {
      const paramsWithSensitive = DEFAULT_SENSITIVE_PARAMS.slice(0, 3).join('&')
      window.location.href = `https://example.com/page?${paramsWithSensitive}=test&page=1`
      window.location.search = `?${paramsWithSensitive}=test&page=1`

      clearDefaultSensitiveParamsFromUrl()

      expect(window.history.replaceState).toHaveBeenCalled()
      const callArgs = (window.history.replaceState as any).mock.calls[0]
      const newUrl = new URL(callArgs[2])
      
      // Should not have sensitive params
      DEFAULT_SENSITIVE_PARAMS.forEach(param => {
        expect(newUrl.searchParams.has(param)).toBe(false)
      })
      
      // Should keep non-sensitive params
      expect(newUrl.searchParams.has('page')).toBe(true)
    })
  })
})


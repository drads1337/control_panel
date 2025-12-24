import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchLicenseKeys, getLicenseKeys } from '../key'
import { enhancedApi as api } from '@/shared/api/enhanced-client'

// Mock the API client
vi.mock('@/shared/api/enhanced-client', () => ({
  enhancedApi: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

// Mock request-manager
vi.mock('@/shared/lib/request-manager', () => ({
  preventDuplicateRequest: (key: string, fn: () => Promise<any>) => fn(),
}))

describe('Key API Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should use POST method for searchLicenseKeys to prevent PII in URL', async () => {
    const mockResponse = {
      data: {
        keys: [],
        total: 0,
        pages: 0,
        current_page: 1,
        per_page: 20,
      },
    }

    vi.mocked(api.post).mockResolvedValue(mockResponse)

    const searchTerm = 'ABC-123-XYZ' // License key (sensitive data)
    await searchLicenseKeys({
      search: searchTerm,
      page: 1,
      per_page: 20,
    })

    // Verify POST was called (not GET)
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.get).not.toHaveBeenCalled()

    // Verify the search term is in the request body
    const postCall = vi.mocked(api.post).mock.calls[0]
    expect(postCall[1]).toHaveProperty('search', searchTerm)
  })

  it('should allow GET for getLicenseKeys without search parameter', async () => {
    const mockResponse = {
      data: {
        keys: [],
        total: 0,
        pages: 0,
        current_page: 1,
        per_page: 20,
      },
    }

    vi.mocked(api.get).mockResolvedValue(mockResponse)

    // No search parameter - GET is acceptable
    await getLicenseKeys(1, 20)

    expect(api.get).toHaveBeenCalledTimes(1)
    expect(api.post).not.toHaveBeenCalled()
  })

  it('should send search term in request body, not query params for searchLicenseKeys', async () => {
    const mockResponse = {
      data: {
        keys: [],
        total: 0,
        pages: 0,
        current_page: 1,
        per_page: 20,
      },
    }

    vi.mocked(api.post).mockResolvedValue(mockResponse)

    const sensitiveSearchTerm = 'LICENSE-KEY-12345' // License key (sensitive)
    await searchLicenseKeys({
      search: sensitiveSearchTerm,
      page: 1,
      per_page: 20,
    })

    const postCall = vi.mocked(api.post).mock.calls[0]
    const requestBody = postCall[1]

    // Verify search term is in body, not in URL params
    expect(requestBody).toHaveProperty('search', sensitiveSearchTerm)
    expect(postCall[2]?.params).toBeUndefined()
  })
})








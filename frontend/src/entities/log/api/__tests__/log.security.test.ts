import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchLogs } from '../log'
import { enhancedApi as api } from '@/shared/api/enhanced-client'

// Mock the API client
vi.mock('@/shared/api/enhanced-client', () => ({
  enhancedApi: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

describe('Log API Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should use POST method for searchLogs to prevent PII in URL', async () => {
    const mockResponse = {
      data: {
        logs: [],
        total: 0,
        pages: 0,
        current_page: 1,
        per_page: 20,
      },
    }

    vi.mocked(api.post).mockResolvedValue(mockResponse)

    const searchTerm = 'test@example.com' // Contains PII (email)
    await searchLogs(searchTerm, 1, 20)

    // Verify POST was called (not GET)
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.get).not.toHaveBeenCalled()

    // Verify the search term is in the request body, not URL params
    const postCall = vi.mocked(api.post).mock.calls[0]
    expect(postCall[1]).toEqual({
      q: searchTerm,
      page: 1,
      per_page: 20,
    })

    // Verify no query parameters were passed
    expect(postCall[2]?.params).toBeUndefined()
  })

  it('should send search term in request body, not query params', async () => {
    const mockResponse = {
      data: {
        logs: [],
        total: 0,
        pages: 0,
        current_page: 1,
        per_page: 20,
      },
    }

    vi.mocked(api.post).mockResolvedValue(mockResponse)

    const sensitiveSearchTerm = 'username123' // Potential PII
    await searchLogs(sensitiveSearchTerm, 1, 20)

    const postCall = vi.mocked(api.post).mock.calls[0]
    const requestBody = postCall[1]

    // Verify search term is in body
    expect(requestBody).toHaveProperty('q', sensitiveSearchTerm)
    expect(requestBody).toHaveProperty('page', 1)
    expect(requestBody).toHaveProperty('per_page', 20)
  })
})








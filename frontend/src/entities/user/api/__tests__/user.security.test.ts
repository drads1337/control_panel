import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchUsers, getUsers } from '../user'
import { enhancedApi as api } from '@/lib/api/enhanced-client'

// Mock the API client
vi.mock('@/lib/api/enhanced-client', () => ({
  enhancedApi: {
    post: vi.fn(),
    get: vi.fn(),
  },
}))

describe('User API Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should use POST method for searchUsers to prevent PII in URL', async () => {
    const mockResponse = {
      data: {
        users: [],
        total: 0,
        pages: 0,
        current_page: 1,
        per_page: 20,
      },
    }

    vi.mocked(api.post).mockResolvedValue(mockResponse)

    const searchTerm = 'user@example.com' // Contains PII (email)
    await searchUsers({ search: searchTerm, page: 1, per_page: 20 })

    // Verify POST was called (not GET)
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(api.get).not.toHaveBeenCalled()

    // Verify the search term is in the request body
    const postCall = vi.mocked(api.post).mock.calls[0]
    expect(postCall[1]).toHaveProperty('search', searchTerm)
  })

  it('should allow GET for getUsers without search parameter', async () => {
    const mockResponse = {
      data: {
        users: [],
        total: 0,
        pages: 0,
        current_page: 1,
        per_page: 20,
      },
    }

    vi.mocked(api.get).mockResolvedValue(mockResponse)

    // No search parameter - GET is acceptable
    await getUsers({ page: 1, per_page: 20 })

    expect(api.get).toHaveBeenCalledTimes(1)
    expect(api.post).not.toHaveBeenCalled()
  })

  it('should send search term in request body, not query params for searchUsers', async () => {
    const mockResponse = {
      data: {
        users: [],
        total: 0,
        pages: 0,
        current_page: 1,
        per_page: 20,
      },
    }

    vi.mocked(api.post).mockResolvedValue(mockResponse)

    const sensitiveSearchTerm = 'john.doe@example.com' // Contains PII
    await searchUsers({
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


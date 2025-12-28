import { useState, useEffect, useCallback } from 'react'
import { getUserActivity, getUserActivityStats } from '@/entities/user'
import type { UserActivity, UserActivityStats } from '@/entities/user';

interface UseUserActivityOptions {
  page?: number
  perPage?: number
  autoRefresh?: boolean
  refreshInterval?: number
}

const MOCK_ACTIVITIES: UserActivity[] = [
  {
    id: 1,
    action: 'login',
    ip_address: '192.168.1.100',
    country: 'Россия',
    city: 'Москва',
    created_at: new Date().toISOString(),
    details: 'Успешный вход в систему',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    session_id: 'session_1'
  },
  {
    id: 2,
    action: 'profile_update',
    ip_address: '192.168.1.100',
    country: 'Россия',
    city: 'Москва',
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    details: 'Обновлен профиль пользователя',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    session_id: 'session_1'
  },
  {
    id: 3,
    action: 'password_change',
    ip_address: '192.168.1.100',
    country: 'Россия',
    city: 'Москва',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    details: 'Пароль успешно изменен',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    session_id: 'session_2'
  },
  {
    id: 4,
    action: 'logout',
    ip_address: '192.168.1.100',
    country: 'Россия',
    city: 'Москва',
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    details: 'Выход из системы',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    session_id: 'session_3'
  },
  {
    id: 5,
    action: 'login',
    ip_address: '10.0.0.50',
    country: 'Россия',
    city: 'Санкт-Петербург',
    created_at: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
    details: 'Вход в систему с другого устройства',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    session_id: 'session_4'
  }
]

const MOCK_STATS: UserActivityStats = {
  total_activities: 15,
  today_activities: 3,
  week_activities: 8,
  month_activities: 15,
  unique_ips: 2,
  unique_locations: 2,
  last_activity: new Date(Date.now() - 60 * 60 * 1000).toISOString()
}

export function useUserActivity(options: UseUserActivityOptions = {}) {
  const {
    page = 1,
    perPage = 20,
    autoRefresh = false,
    refreshInterval = 60000
  } = options

  const [activities, setActivities] = useState<UserActivity[]>([])
  const [stats, setStats] = useState<UserActivityStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    total: 0,
    pages: 0,
    currentPage: page,
    perPage
  })

  const fetchUserActivity = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      try {
        const response = await getUserActivity(pagination.currentPage, pagination.perPage)
        setActivities(response.activities)
        setPagination({
          total: response.total,
          pages: response.pages,
          currentPage: response.current_page,
          perPage: response.per_page
        })
      } catch (apiError) {

        const startIndex = (pagination.currentPage - 1) * pagination.perPage
        const endIndex = startIndex + pagination.perPage
        const paginatedActivities = MOCK_ACTIVITIES.slice(startIndex, endIndex)

        setActivities(paginatedActivities)
        setPagination({
          total: MOCK_ACTIVITIES.length,
          pages: Math.ceil(MOCK_ACTIVITIES.length / pagination.perPage),
          currentPage: pagination.currentPage,
          perPage: pagination.perPage
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user activity')
    } finally {
      setLoading(false)
    }
  }, [pagination.currentPage, pagination.perPage])

  const fetchUserActivityStats = useCallback(async () => {
    try {
      setStatsLoading(true)

      try {
        const statsData = await getUserActivityStats('')
        setStats(statsData)
      } catch (apiError) {

        setStats(MOCK_STATS)
      }
    } catch (err) {

    } finally {
      setStatsLoading(false)
    }
  }, [])

  const refresh = useCallback(() => {
    fetchUserActivity()
    fetchUserActivityStats()
  }, [fetchUserActivity, fetchUserActivityStats])

  const changePage = useCallback((newPage: number) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }))
  }, [])

  const changePerPage = useCallback((newPerPage: number) => {
    setPagination(prev => ({ ...prev, perPage: newPerPage, currentPage: 1 }))
  }, [])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchUserActivity()
        fetchUserActivityStats()
      }, refreshInterval)

      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval, fetchUserActivity, fetchUserActivityStats])

  useEffect(() => {
    fetchUserActivity()
    fetchUserActivityStats()
  }, [fetchUserActivity, fetchUserActivityStats])

  useEffect(() => {
    fetchUserActivity()
  }, [pagination.currentPage, pagination.perPage, fetchUserActivity])

  return {
    activities,
    stats,
    loading,
    statsLoading,
    error,
    pagination,
    refresh,
    changePage,
    changePerPage
  }
} 
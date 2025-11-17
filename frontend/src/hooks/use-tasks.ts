/**
 * Hook for managing async tasks with real-time updates
 */

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { toast } from 'sonner'

export interface Task {
  id: string
  type: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  progress: number
  result?: any
  error?: string
  created_at: string
  updated_at?: string
  user_id?: number
  project_id?: number
}

// Cache keys for tasks
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: () => [...taskKeys.lists()] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
}

export interface UseTasksOptions {
  autoRefresh?: boolean
  refreshInterval?: number
}

export function useTasks(options: UseTasksOptions = {}) {
  const { autoRefresh = true, refreshInterval = 2000 } = options
  const queryClient = useQueryClient()

  // Fetch user tasks with React Query
  const {
    data: tasksData,
    isLoading,
    error,
    refetch: fetchTasks,
  } = useQuery<Task[]>({
    queryKey: taskKeys.list(),
    queryFn: async () => {
      // CSRF token and credentials are automatically handled by axios interceptors in base.ts
      const response = await api.get('/api/websocket/user-tasks')
      return (response.data.tasks || []) as Task[]
    },
    staleTime: 0, // Always refetch on mount for real-time tasks
    gcTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: autoRefresh ? refreshInterval : false,
    refetchIntervalInBackground: true,
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return false
      }
      // Retry up to 2 times for other errors
      return failureCount < 2
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })

  const tasks = tasksData || []
  
  // Handle errors with useEffect to avoid showing toast on every render
  useEffect(() => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch tasks'
      console.error('Failed to fetch tasks:', error)
      toast.error('Failed to load tasks')
    }
  }, [error])
  
  // Calculate active tasks
  const activeTasks = new Set<string>(
    tasks
      .filter((task: Task) => task.status === 'pending' || task.status === 'in_progress')
      .map((task: Task) => task.id)
  )

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async ({ taskType, taskData }: { taskType: string; taskData: any }) => {
      // CSRF token and credentials are automatically handled by axios interceptors in base.ts
      const response = await api.post('/api/tasks', {
        type: taskType,
        data: taskData
      })
      return response.data.task_id as string
    },
    onSuccess: () => {
      // Invalidate tasks list to refetch
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
      toast.success('Task created successfully')
    },
    onError: (err) => {
      console.error('Failed to create task:', err)
      toast.error('Failed to create task')
    },
  })

  // Get task status by ID with React Query
  const getTaskStatus = async (taskId: string): Promise<Task | null> => {
    try {
      const data = await queryClient.fetchQuery({
        queryKey: taskKeys.detail(taskId),
        queryFn: async () => {
          try {
            // CSRF token and credentials are automatically handled by axios interceptors in base.ts
            const response = await api.get(`/api/websocket/task-status/${taskId}`)
            return response.data as Task
          } catch (err: any) {
            if (err?.response?.status === 404) {
              return null
            }
            throw err
          }
        },
        staleTime: 1 * 60 * 1000, // 1 minute
      })

      return data
    } catch (err) {
      console.error('Failed to get task status:', err)
      toast.error('Failed to get task status')
      return null
    }
  }

  // Create task wrapper
  const createTask = async (taskType: string, taskData: any): Promise<string | null> => {
    try {
      const taskId = await createTaskMutation.mutateAsync({ taskType, taskData })
      return taskId
    } catch {
      return null
    }
  }

  // Clear completed tasks (optimistic update)
  const clearCompletedTasks = () => {
    queryClient.setQueryData<Task[]>(taskKeys.list(), (oldData) => {
      if (!oldData) return []
      return oldData.filter(task => 
        task.status !== 'completed' && task.status !== 'failed'
      )
    })
  }

  // Convert error to string for compatibility
  const errorMessage = error
    ? (error as any)?.response?.data?.message || 
      (error as any)?.message || 
      'Failed to load tasks'
    : null

  return {
    tasks,
    loading: isLoading,
    error: errorMessage,
    activeTasks,
    fetchTasks,
    getTaskStatus,
    createTask,
    clearCompletedTasks,
  }
}

// Hook for tracking a specific task
export function useTask(taskId: string | null, options: { autoRefresh?: boolean; refreshInterval?: number } = {}) {
  const { autoRefresh = true, refreshInterval = 2000 } = options

  const {
    data: task,
    isLoading,
    error,
    refetch: fetchTask,
  } = useQuery<Task | null>({
    queryKey: taskKeys.detail(taskId || ''),
    queryFn: async () => {
      if (!taskId) return null

      try {
        // CSRF token and credentials are automatically handled by axios interceptors in base.ts
        const response = await api.get(`/api/websocket/task-status/${taskId}`)
        return response.data as Task
      } catch (err: any) {
        if (err?.response?.status === 404) {
          return null
        }
        throw err
      }
    },
    enabled: !!taskId,
    staleTime: 0, // Always refetch on mount for real-time task status
    gcTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: (query) => {
      // Only auto-refresh if task is active and autoRefresh is enabled
      if (!autoRefresh || !taskId) return false
      const task = query.state.data as Task | null
      if (!task || (task.status !== 'pending' && task.status !== 'in_progress')) {
        return false
      }
      return refreshInterval
    },
    refetchIntervalInBackground: true,
    retry: (failureCount, error: any) => {
      // Don't retry on 404 or auth errors
      if (error?.response?.status === 404 || 
          error?.response?.status === 401 || 
          error?.response?.status === 403) {
        return false
      }
      return failureCount < 2
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })

  // Handle errors with useEffect to avoid showing toast on every render
  useEffect(() => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch task'
      console.error('Failed to fetch task:', error)
      toast.error('Failed to load task details')
    }
  }, [error])

  // Convert error to string for compatibility
  const errorMessage = error
    ? (error as any)?.response?.data?.message || 
      (error as any)?.message || 
      'Failed to load task'
    : null

  return {
    task: task || null,
    loading: isLoading,
    error: errorMessage,
    fetchTask,
  }
}

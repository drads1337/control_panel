
import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { getErrorMessage, getErrorStatus, isAxiosError } from '@/lib/error-utils'
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

  const {
    data: tasksData,
    isLoading,
    error,
    refetch: fetchTasks,
  } = useQuery<Task[]>({
    queryKey: taskKeys.list(),
    queryFn: async () => {

      const response = await api.get('/api/websocket/user-tasks')
      return (response.data.tasks || []) as Task[]
    },
    staleTime: 0,
    gcTime: 1 * 60 * 1000,
    refetchInterval: autoRefresh ? refreshInterval : false,
    refetchIntervalInBackground: true,
    retry: (failureCount, error: unknown) => {
      const status = getErrorStatus(error)
      if (status === 401 || status === 403) {
        return false
      }
      return failureCount < 2
    },
    refetchOnWindowFocus: false, // Disabled - data refreshes via refetchInterval
    refetchOnReconnect: true,
  })

  const tasks = tasksData || []

  useEffect(() => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch tasks'

      toast.error('Failed to load tasks')
    }
  }, [error])

  const activeTasks = new Set<string>(
    tasks
      .filter((task: Task) => task.status === 'pending' || task.status === 'in_progress')
      .map((task: Task) => task.id)
  )

  const createTaskMutation = useMutation({
    mutationFn: async ({ taskType, taskData }: { taskType: string; taskData: any }) => {

      const response = await api.post('/api/tasks', {
        type: taskType,
        data: taskData
      })
      return response.data.task_id as string
    },
    onSuccess: () => {

      queryClient.invalidateQueries({ queryKey: taskKeys.lists() })
      toast.success('Task created successfully')
    },
    onError: (err) => {

      toast.error('Failed to create task')
    },
  })

  const getTaskStatus = async (taskId: string): Promise<Task | null> => {
    try {
      const data = await queryClient.fetchQuery({
        queryKey: taskKeys.detail(taskId),
        queryFn: async () => {
          try {

            const response = await api.get(`/api/websocket/task-status/${taskId}`)
            return response.data as Task
          } catch (err: unknown) {
            const status = getErrorStatus(err)
            if (status === 404) {
              return null
            }
            throw err
          }
        },
        staleTime: 1 * 60 * 1000,
      })

      return data
    } catch (err) {

      toast.error('Failed to get task status')
      return null
    }
  }

  const createTask = async (taskType: string, taskData: any): Promise<string | null> => {
    try {
      const taskId = await createTaskMutation.mutateAsync({ taskType, taskData })
      return taskId
    } catch {
      return null
    }
  }

  const clearCompletedTasks = () => {
    queryClient.setQueryData<Task[]>(taskKeys.list(), (oldData) => {
      if (!oldData) return []
      return oldData.filter(task => 
        task.status !== 'completed' && task.status !== 'failed'
      )
    })
  }

  const errorMessage = error
    ? getErrorMessage(error)
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

        const response = await api.get(`/api/websocket/task-status/${taskId}`)
        return response.data as Task
      } catch (err: unknown) {
        const status = getErrorStatus(err)
        if (status === 404) {
          return null
        }
        throw err
      }
    },
    enabled: !!taskId,
    staleTime: 0,
    gcTime: 1 * 60 * 1000,
    refetchInterval: (query) => {

      if (!autoRefresh || !taskId) return false
      const task = query.state.data as Task | null
      if (!task || (task.status !== 'pending' && task.status !== 'in_progress')) {
        return false
      }
      return refreshInterval
    },
    refetchIntervalInBackground: true,
    retry: (failureCount, error: unknown) => {
      const status = getErrorStatus(error)
      if (status === 404 || status === 401 || status === 403) {
        return false
      }
      return failureCount < 2
    },
    refetchOnWindowFocus: false, // Disabled - data refreshes via refetchInterval
    refetchOnReconnect: true,
  })

  useEffect(() => {
    if (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch task'

      toast.error('Failed to load task details')
    }
  }, [error])

  const errorMessage = error
    ? getErrorMessage(error)
    : null

  return {
    task: task || null,
    loading: isLoading,
    error: errorMessage,
    fetchTask,
  }
}

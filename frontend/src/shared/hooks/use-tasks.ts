import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getErrorMessage, getErrorStatus } from '@/shared/lib/utils/error-utils'
import { toast } from 'sonner'
import { getTasks, getTaskStatus as fetchTaskStatus, createTask as createTaskApi } from '@/entities/task/api'
import { taskKeys } from '@/entities/task/model/queries'
import type { Task } from '@/entities/task'

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
    queryFn: getTasks,
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
      return createTaskApi(taskType, taskData)
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
        queryFn: () => fetchTaskStatus(taskId),
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
    queryFn: () => {
      if (!taskId) return Promise.resolve(null)
      return fetchTaskStatus(taskId)
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

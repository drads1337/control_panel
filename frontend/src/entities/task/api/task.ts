import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { apiCall } from '@/shared/api/api-wrapper'
import { getErrorStatus } from '@/shared/lib/utils/error-utils'
import type { Task } from '../model/types'

/**
 * API endpoints for task management
 */
export const TASK_ENDPOINTS = {
  LIST: '/api/websocket/user-tasks',
  STATUS: (taskId: string) => `/api/websocket/task-status/${taskId}`,
  CREATE: '/api/tasks',
} as const

/**
 * Fetch all user tasks
 */
export async function getTasks(): Promise<Task[]> {
  return apiCall(
    () => api.get(TASK_ENDPOINTS.LIST),
    {
      extractData: (response) => (response.data.tasks || []) as Task[],
    }
  )
}

/**
 * Get task status by ID
 * Returns null if task is not found (404)
 */
export async function getTaskStatus(taskId: string): Promise<Task | null> {
  try {
    return await apiCall(
      () => api.get(TASK_ENDPOINTS.STATUS(taskId)),
      {
        extractData: (response) => response.data as Task,
      }
    )
  } catch (error) {
    // Handle 404 as null (task not found)
    const status = getErrorStatus(error)
    if (status === 404) {
      return null
    }
    throw error
  }
}

/**
 * Create a new task
 */
export async function createTask(taskType: string, taskData: any): Promise<string> {
  return apiCall(
    () => api.post(TASK_ENDPOINTS.CREATE, {
      type: taskType,
      data: taskData,
    }),
    {
      extractData: (response) => response.data.task_id as string,
    }
  )
}


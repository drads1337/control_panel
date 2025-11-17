import { enhancedApi as api } from '@/shared/api/enhanced-client'
import { API_ENDPOINTS } from '@/shared/api/config'
import type { UsersResponse, CreateUserData, UpdateUserData, User } from '@/entities/user';
import type {
  UsersResponse as UserTypesResponse,
  CreateUserData as UserCreateData,
  UpdateUserData as UserUpdateData,
  User as UserType,
  UserStats
} from '../model/types'

// User API functions
// All functions use centralized axios instance with CSRF protection
export async function getUsers(params?: {
  page?: number
  per_page?: number
  role?: string
  roles?: string[]
  search?: string
  project_id?: number
}): Promise<UserTypesResponse> {
  console.log('API: getUsers params:', params)

  const requestParams: Record<string, any> = {}
  if (params?.page) requestParams.page = params.page.toString()
  if (params?.per_page) requestParams.per_page = params.per_page.toString()
  if (params?.role) requestParams.role = params.role
  if (params?.roles && params.roles.length > 0) {
    requestParams.roles = params.roles
  }
  if (params?.search) requestParams.search = params.search
  if (params?.project_id) requestParams.project_id = params.project_id.toString()

  // CSRF token is automatically added by axios interceptor
  const response = await api.get(API_ENDPOINTS.USERS, { params: requestParams })
  
  console.log('API: getUsers success response:', response.data)
  if (response.data.users && response.data.users.length > 0) {
    console.log('API: First user full data:', JSON.stringify(response.data.users[0], null, 2))
  }
  
  return response.data
}

export async function createUser(userData: UserCreateData): Promise<UserType> {
  // CSRF token is automatically added by axios interceptor
  const response = await api.post(API_ENDPOINTS.USERS_ADD, userData)
  return response.data
}

export async function updateUser(userId: number, userData: UserUpdateData): Promise<UserType> {
  console.log('🔧 [updateUser] Starting update for user:', userId)
  
  // CSRF token is automatically added by axios interceptor
  const response = await api.put(`${API_ENDPOINTS.USERS}/${userId}`, userData)
  
  console.log('🔧 [updateUser] Success response:', response.data)
  return response.data
}

export async function deleteUser(userId: number): Promise<void> {
  // CSRF token is automatically added by axios interceptor
  await api.delete(`${API_ENDPOINTS.USERS}/${userId}`)
}

export async function getUserStats(): Promise<UserStats> {
  // CSRF token is automatically added by axios interceptor
  const response = await api.get(API_ENDPOINTS.USERS_STATS)
  return response.data
}

export async function getClients(): Promise<{ clients: UserType[] }> {
  // CSRF token is automatically added by axios interceptor
  const response = await api.get('/api/users/clients')
  return response.data
}

// Bulk client operations
export async function bulkDeleteClients(
  options: {
    client_ids?: number[];
    game_id?: number;
    filters?: {
      status?: string;
      project_id?: number;
      search?: string;
    };
  }
): Promise<{ 
  message: string; 
  deleted_count: number; 
  deleted_clients: Array<{ id: number; username: string; name: string }> 
}> {
  // CSRF token is automatically added by axios interceptor
  const response = await api.post('/api/users/clients/bulk-delete', options)
  return response.data
}

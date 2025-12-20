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


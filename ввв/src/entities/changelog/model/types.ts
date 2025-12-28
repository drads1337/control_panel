
export interface ChangelogEntry {
  id: number
  version: string
  title: string
  description?: string
  changes: string[]
  release_date: string
  is_public: boolean
  created_by?: number
}

export interface ChangelogResponse {
  success: boolean
  product_id: number
  product_name: string
  changelog: ChangelogEntry[]
}

export interface CreateChangelogData {
  version: string
  title: string
  description?: string
  changes: string[]
  release_date?: string
  is_public?: boolean
}

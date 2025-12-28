
export interface ApiMetrics {
  api_requests: {
    successful: number
    failed: number
    pending: number
  }
  api_connections: {
    connected: number
    disconnected: number
    reconnecting: number
  }
  performance_data: Array<{
    time: string
    requests: number
    errors: number
    latency: number
  }>
  system_load_data: Array<{
    time: string
    cpu: number
    memory: number
    disk: number
    network: number
  }>
  user_activity_data: Array<{
    date: string
    active: number
    new: number
    returning: number
    key_generation: number
    key_activation: number
    key_expired: number
    connect_requests: number
  }>
}

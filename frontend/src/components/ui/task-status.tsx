/**
 * Task Status Component for displaying async task progress
 */

import React from 'react'
import { Task } from '@/hooks/use-tasks'
import { CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { User } from '@/entities/user';

interface TaskStatusProps {
  task: Task
  showDetails?: boolean
  className?: string
}

export const TaskStatus = React.memo(function TaskStatus({ task, showDetails = false, className = '' }: TaskStatusProps) {
  const getStatusIcon = () => {
    switch (task.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'in_progress':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = () => {
    switch (task.status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getTaskTypeDisplay = (type: string) => {
    const typeMap: Record<string, string> = {
      'server_start': 'Server Start',
      'server_stop': 'Server Stop',
      'server_restart': 'Server Restart',
      'server_status_check': 'Status Check',
      'backup_create': 'Backup Creation',
      'backup_restore': 'Backup Restore',
      'user_import': 'User Import',
      'data_export': 'Data Export'
    }
    return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (!showDetails) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        {getStatusIcon()}
        <span className="text-sm font-medium">{getTaskTypeDisplay(task.type)}</span>
        <Badge className={getStatusColor()}>
          {task.status.replace('_', ' ')}
        </Badge>
        {task.status === 'in_progress' && (
          <div className="w-16">
            <Progress value={task.progress} className="h-1" />
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center space-x-2">
            {getStatusIcon()}
            <span>{getTaskTypeDisplay(task.type)}</span>
          </CardTitle>
          <Badge className={getStatusColor()}>
            {task.status.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {task.status === 'in_progress' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{task.progress}%</span>
            </div>
            <Progress value={task.progress} />
          </div>
        )}
        
        {task.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800 font-medium">Error:</p>
            <p className="text-sm text-red-700">{task.error}</p>
          </div>
        )}
        
        {task.result && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800 font-medium">Result:</p>
            <p className="text-sm text-green-700">
              {typeof task.result === 'string' ? task.result : JSON.stringify(task.result)}
            </p>
          </div>
        )}
        
        <div className="text-xs text-gray-500 space-y-1">
          <p>Created: {formatDate(task.created_at)}</p>
          {task.updated_at && (
            <p>Updated: {formatDate(task.updated_at)}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
});

interface TaskListProps {
  tasks: Task[]
  showCompleted?: boolean
  maxItems?: number
  className?: string
}

export function TaskList({ 
  tasks, 
  showCompleted = false, 
  maxItems = 10, 
  className = '' 
}: TaskListProps) {
  const filteredTasks = tasks
    .filter(task => showCompleted || (task.status !== 'completed' && task.status !== 'failed'))
    .slice(0, maxItems)

  if (filteredTasks.length === 0) {
    return (
      <div className={`text-center py-8 text-gray-500 ${className}`}>
        <Clock className="h-8 w-8 mx-auto mb-2 text-gray-400" />
        <p>No active tasks</p>
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {filteredTasks.map((task) => (
        <TaskStatus key={task.id} task={task} showDetails={true} />
      ))}
    </div>
  )
}

interface TaskNotificationProps {
  task: Task
  onClose?: () => void
}

export function TaskNotification({ task, onClose }: TaskNotificationProps) {
  const getNotificationIcon = () => {
    switch (task.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />
      default:
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
    }
  }

  const getNotificationTitle = () => {
    const typeDisplay = task.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    switch (task.status) {
      case 'completed':
        return `${typeDisplay} Completed`
      case 'failed':
        return `${typeDisplay} Failed`
      case 'in_progress':
        return `${typeDisplay} In Progress`
      default:
        return `${typeDisplay} Started`
    }
  }

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
      <div className="flex items-start space-x-3">
        {getNotificationIcon()}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">
            {getNotificationTitle()}
          </p>
          {task.status === 'in_progress' && (
            <div className="mt-2">
              <Progress value={task.progress} className="h-1" />
              <p className="text-xs text-gray-500 mt-1">{task.progress}% complete</p>
            </div>
          )}
          {task.error && (
            <p className="text-xs text-red-600 mt-1">{task.error}</p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}

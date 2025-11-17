'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getApiUrl } from '@/lib/api-client'
import { ArrowRight, Loader } from 'lucide-react'

// Type guard: Validate activity item structure
interface ActivityItem {
  id: string
  type: 'credit_debit' | 'credit_credit' | 'case_analysis'
  title: string
  description?: string
  creditAmount?: number
  creditCategory?: 'REPORT' | 'FULL'
  caseId?: string
  caseName?: string
  analysisVersion?: number
  status?: string
  timestamp: string
  icon: string
}

function isActivityItem(data: unknown): data is ActivityItem {
  if (typeof data !== 'object' || data === null) return false
  const item = data as Record<string, unknown>
  return (
    'id' in item &&
    typeof item.id === 'string' &&
    'type' in item &&
    ('title' in item && typeof item.title === 'string') &&
    'timestamp' in item &&
    typeof item.timestamp === 'string' &&
    'icon' in item &&
    typeof item.icon === 'string'
  )
}

interface ActivityFeedProps {
  limit?: number
  showTitle?: boolean
  className?: string
  onActivityClick?: (activity: ActivityItem) => void
}

export function ActivityFeed({
  limit = 10,
  showTitle = true,
  className = '',
  onActivityClick
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        getApiUrl(`/api/user/activity?limit=${limit}`),
        { credentials: 'include' }
      )

      if (!response.ok) {
        throw new Error(`Failed to load activities: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.success && Array.isArray(data.data)) {
        // Type guard: Filter and validate activities
        const validActivities = data.data.filter(isActivityItem)
        setActivities(validActivities)
      } else {
        setActivities([])
      }
    } catch (err) {
      console.error('Error loading activities:', err)
      setError(err instanceof Error ? err.message : 'Failed to load activities')
      setActivities([])
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    loadActivities()
  }, [loadActivities])

  const getActivityColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'credit_debit':
        return 'border-orange-200 bg-orange-50'
      case 'credit_credit':
        return 'border-green-200 bg-green-50'
      case 'case_analysis':
        return 'border-blue-200 bg-blue-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  const getTypeLabel = (type: ActivityItem['type']) => {
    switch (type) {
      case 'credit_debit':
        return 'Crédito Utilizado'
      case 'credit_credit':
        return 'Créditos Adicionados'
      case 'case_analysis':
        return 'Análise Concluída'
      default:
        return 'Atividade'
    }
  }

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Agora'
    if (diffMins < 60) return `${diffMins}m atrás`
    if (diffHours < 24) return `${diffHours}h atrás`
    if (diffDays < 7) return `${diffDays}d atrás`

    return date.toLocaleDateString('pt-BR')
  }

  // Loading skeleton
  if (loading) {
    return (
      <Card className={className}>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ⏰ Atividade Recente
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
          ))}
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error) {
    return (
      <Card className={className}>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ⏰ Atividade Recente
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600 text-sm">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={loadActivities}
            >
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Empty state
  if (activities.length === 0) {
    return (
      <Card className={className}>
        {showTitle && (
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ⏰ Atividade Recente
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">Nenhuma atividade registrada</p>
            <p className="text-xs text-gray-400 mt-1">
              Sua atividade aparecerá aqui quando você começar a usar os serviços
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      {showTitle && (
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ⏰ Atividade Recente
          </CardTitle>
        </CardHeader>
      )}
      <CardContent>
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className={`border rounded-lg p-4 hover:shadow-md transition-all duration-200 cursor-pointer ${getActivityColor(activity.type)}`}
              onClick={() => onActivityClick?.(activity)}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="text-2xl mt-0.5">{activity.icon}</div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="font-medium text-sm truncate">{activity.title}</h4>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      {getTypeLabel(activity.type)}
                    </Badge>
                  </div>

                  {activity.description && (
                    <p className="text-xs text-gray-600 mb-2">{activity.description}</p>
                  )}

                  {/* Activity-specific details */}
                  <div className="text-xs text-gray-500 space-y-1">
                    {activity.creditAmount !== undefined && (
                      <p>
                        Créditos:{' '}
                        <span className="font-medium">
                          {activity.type === 'credit_debit' ? '-' : '+'}
                          {Math.abs(activity.creditAmount)}
                        </span>
                      </p>
                    )}

                    {activity.caseName && (
                      <p>
                        Caso:{' '}
                        <span className="font-medium">{activity.caseName}</span>
                      </p>
                    )}

                    {activity.status && (
                      <p>
                        Status:{' '}
                        <span
                          className={`font-medium ${
                            activity.status === 'COMPLETED'
                              ? 'text-green-600'
                              : activity.status === 'FAILED'
                                ? 'text-red-600'
                                : 'text-yellow-600'
                          }`}
                        >
                          {activity.status === 'COMPLETED'
                            ? 'Concluída'
                            : activity.status === 'FAILED'
                              ? 'Erro'
                              : 'Processando'}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Timestamp */}
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-500 whitespace-nowrap">
                    {formatTimestamp(activity.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View More Button */}
        {activities.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-4 gap-2"
            onClick={() => (window.location.href = '/dashboard/billing')}
          >
            Ver Histórico Completo <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export default ActivityFeed

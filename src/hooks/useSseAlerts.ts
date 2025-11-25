'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

/**
 * SSE Alert Event Types (Type-Safe)
 */
interface AlertCountUpdate {
  type: 'alert_count_update'
  unreadCount: number
  criticalCount: number
  timestamp: number
}

interface NewAlert {
  type: 'new_alert'
  id: string
  severity: 'critical' | 'warning' | 'info'
  message: string
  timestamp: number
}

type SSEAlert = AlertCountUpdate | NewAlert

/**
 * Type Guard: Validates alert count update
 */
function isAlertCountUpdate(data: unknown): data is AlertCountUpdate {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return (
    obj.type === 'alert_count_update' &&
    typeof obj.unreadCount === 'number' &&
    typeof obj.criticalCount === 'number' &&
    typeof obj.timestamp === 'number'
  )
}

/**
 * Type Guard: Validates new alert
 */
function isNewAlert(data: unknown): data is NewAlert {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return (
    obj.type === 'new_alert' &&
    typeof obj.id === 'string' &&
    (obj.severity === 'critical' || obj.severity === 'warning' || obj.severity === 'info') &&
    typeof obj.message === 'string' &&
    typeof obj.timestamp === 'number'
  )
}

/**
 * Hook Padrão-Ouro: Gerencia alertas em tempo real via SSE
 *
 * Características:
 * - Conexão SSE automática ao /api/sse/subscribe
 * - Type-safe (zero `any`, type guards)
 * - Limpeza automática de recursos
 * - Retry automático em desconexões (3s)
 * - Gerencia estado de unreadCount e criticalCount
 *
 * Uso:
 * ```tsx
 * const { criticalCount, isConnected, clearAlerts } = useSseAlerts()
 * ```
 */
export function useSseAlerts() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [criticalCount, setCriticalCount] = useState(0)
  const [isConnected, setIsConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Conectar ao SSE
  useEffect(() => {
    if (typeof window === 'undefined') return

    const connectSSE = () => {
      try {
        const eventSource = new EventSource('/api/sse/subscribe')
        eventSourceRef.current = eventSource

        // Conexão estabelecida
        eventSource.addEventListener('open', () => {
          setIsConnected(true)
          console.log('✅ SSE conectado para alertas')
        })

        // Receber mensagens de alerta
        eventSource.addEventListener('message', (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data) as unknown

            if (isAlertCountUpdate(data)) {
              // Atualizar contadores de alertas
              setUnreadCount(data.unreadCount)
              setCriticalCount(data.criticalCount)
            } else if (isNewAlert(data)) {
              // Novo alerta chegou - incrementar contador
              setCriticalCount((prev) => prev + 1)

              // Log para debugging
              if (data.severity === 'critical') {
                console.log('🚨 Novo alerta crítico:', data.message)
              }
            }
          } catch (_error) {
            console.error('❌ Erro ao parsear alerta SSE:', error)
          }
        })

        // Erro na conexão
        eventSource.addEventListener('error', () => {
          setIsConnected(false)
          console.warn('⚠️  SSE desconectado, reconectando em 3s...')

          eventSource.close()
          eventSourceRef.current = null

          // Retry automático em 3 segundos
          reconnectTimeoutRef.current = setTimeout(connectSSE, 3000)
        })
      } catch (_error) {
        console.error('❌ Erro ao conectar SSE:', error)
        setIsConnected(false)
      }
    }

    connectSSE()

    // Cleanup ao desmontar
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [])

  // Função para limpar alertas (quando usuário visita página de alertas)
  const clearAlerts = useCallback(() => {
    setUnreadCount(0)
    setCriticalCount(0)
  }, [])

  return {
    unreadCount,
    criticalCount,
    isConnected,
    clearAlerts,
  }
}

'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { useSseAlerts } from '@/hooks/useSseAlerts'

/**
 * AlertBadge - Componente visual para exibir contador de alertas críticos
 *
 * Padrão-Ouro:
 * - Só aparece se houver alertas (count > 0)
 * - Animação sutil (pulse) ao receber novo alerta
 * - Cor vermelha (crítico) para chamar atenção
 * - Acessível com aria-label
 * - Máximo 99+ para não sobrecarregar visualmente
 *
 * Uso:
 * ```tsx
 * <div className="relative">
 *   <SidebarMenuButton>Alertas</SidebarMenuButton>
 *   <AlertBadge />
 * </div>
 * ```
 */
export function AlertBadge() {
  const { criticalCount } = useSseAlerts()
  const [animate, setAnimate] = React.useState(false)

  // Animação ao receber novo alerta (pulse por 3 segundos)
  React.useEffect(() => {
    if (criticalCount > 0) {
      setAnimate(true)
      const timer = setTimeout(() => setAnimate(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [criticalCount])

  // Não renderizar se não há alertas (Padrão-Ouro: silencioso, não é ruído)
  if (criticalCount === 0) {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${criticalCount} alerta${criticalCount > 1 ? 's' : ''} crítico${criticalCount > 1 ? 's' : ''}`}
      className={cn(
        // Posicionamento: absolute ao lado do menu item
        'absolute right-1 top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold tabular-nums',

        // Cores Padrão-Ouro: vermelho para crítico, texto branco
        'bg-red-500 text-white dark:bg-red-600',

        // Animação sutil: pulse enquanto há alertas novos
        animate && 'animate-pulse',

        // Sombra para destacar e criar profundidade
        'shadow-lg shadow-red-500/20 dark:shadow-red-600/20',

        // Z-index para aparecer acima do texto do menu
        'z-10',

        // Transição suave para mudanças
        'transition-all duration-300 ease-out'
      )}
    >
      {/* Mostrar contagem, máximo 99+ */}
      {criticalCount > 99 ? '99+' : criticalCount}
    </div>
  )
}

/**
 * AlertBadgeWithLink - Variante com link para página de alertas
 *
 * Renderiza o badge dentro de um link que leva a /admin/alerts
 *
 * Uso:
 * ```tsx
 * <SidebarMenuItem>
 *   <SidebarMenuButton asChild>
 *     <Link href="/admin/alerts">
 *       <Bell className="size-4" />
 *       <span>Alertas</span>
 *     </Link>
 *   </SidebarMenuButton>
 *   <AlertBadgeWithLink />
 * </SidebarMenuItem>
 * ```
 */
export function AlertBadgeWithLink() {
  const { criticalCount } = useSseAlerts()

  // Não renderizar se não há alertas
  if (criticalCount === 0) {
    return null
  }

  return (
    <a
      href="/admin/alerts"
      className="group relative cursor-pointer"
      title={`${criticalCount} alerta${criticalCount > 1 ? 's' : ''} crítico${criticalCount > 1 ? 's' : ''} - clique para visualizar`}
      onClick={(e) => {
        // Não propagar o clique para o pai (item do menu)
        e.stopPropagation()
      }}
    >
      <AlertBadge />
    </a>
  )
}

/**
 * AlertBadgeIndicator - Variante minimalista (apenas um ponto)
 *
 * Usa um ponto pequeno como indicador visual
 *
 * Útil para espaços limitados (ex: navbar do header)
 */
export function AlertBadgeIndicator() {
  const { criticalCount } = useSseAlerts()
  const [animate, setAnimate] = React.useState(false)

  React.useEffect(() => {
    if (criticalCount > 0) {
      setAnimate(true)
      const timer = setTimeout(() => setAnimate(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [criticalCount])

  if (criticalCount === 0) {
    return null
  }

  return (
    <div
      role="status"
      aria-label={`${criticalCount} alerta${criticalCount > 1 ? 's' : ''} não lido${criticalCount > 1 ? 's' : ''}`}
      className={cn(
        'absolute right-0 top-0 flex h-2.5 w-2.5 items-center justify-center rounded-full',
        'bg-red-500 dark:bg-red-600',
        animate && 'animate-pulse',
        'shadow-lg shadow-red-500/20'
      )}
    />
  )
}

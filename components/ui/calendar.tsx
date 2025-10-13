'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type CalendarProps = React.ComponentProps<'div'> & {
  mode?: 'single' | 'range'
  selected?: Date | { from?: Date; to?: Date }
  onSelect?: (date: Date | { from?: Date; to?: Date } | undefined) => void
  disabled?: (date: Date) => boolean
  fromDate?: Date
  toDate?: Date
}

function Calendar({
  className,
  mode = 'single',
  selected,
  onSelect,
  ...props
}: CalendarProps) {
  return (
    <div className={cn('p-3', className)} {...props}>
      <p className="text-sm text-muted-foreground">
        Calendar component requires react-day-picker to be installed
      </p>
    </div>
  )
}

Calendar.displayName = 'Calendar'

export { Calendar }

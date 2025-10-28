'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

const Popover = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & { open?: boolean; onOpenChange?: (open: boolean) => void }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
>(({ children, open, onOpenChange, ...props }, ref) => {
  return (
    <div ref={ref} {...props}>
      {children}
    </div>
  )
})
Popover.displayName = 'Popover'

const PopoverTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'> & { asChild?: boolean }
>(({ className, children, asChild, ...props }, ref) => {
  if (asChild) {
    return (
      <div className={className} {...(props as React.ComponentProps<'div'>)}>
        {children}
      </div>
    )
  }
  return (
    <button ref={ref} className={className} {...props}>
      {children}
    </button>
  )
})
PopoverTrigger.displayName = 'PopoverTrigger'

const PopoverContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    align?: 'start' | 'center' | 'end'
    sideOffset?: number
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
>(({ className, align, sideOffset, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none',
      className
    )}
    {...props}
  />
))
PopoverContent.displayName = 'PopoverContent'

export { Popover, PopoverTrigger, PopoverContent }

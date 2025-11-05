'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

const RadioGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    value?: string
    onValueChange?: (value: string) => void
  }
>(({ className, value: _value, onValueChange: _onValueChange, children, ...props }, ref) => {
  return (
    <div ref={ref} className={cn('grid gap-2', className)} {...props}>
      {children}
    </div>
  )
})
RadioGroup.displayName = 'RadioGroup'

const RadioGroupItem = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'> & {
    value: string
  }
>(({ className, value, ...props }, ref) => {
  return (
    <input
      ref={ref}
      type="radio"
      value={value}
      className={cn(
        'aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
})
RadioGroupItem.displayName = 'RadioGroupItem'

export { RadioGroup, RadioGroupItem }

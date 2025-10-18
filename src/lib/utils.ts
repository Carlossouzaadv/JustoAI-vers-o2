import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Utility function to merge Tailwind CSS classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format date to Brazilian format
 */
export function formatDate(date: Date | string | null): string {
  if (!date) return 'Data inválida'

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    return new Intl.DateTimeFormat('pt-BR').format(dateObj)
  } catch {
    return 'Data inválida'
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Generate slug from text
 */
export function generateSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

/**
 * Format Brazilian process number
 */
export function formatProcessNumber(processNumber: string): string {
  // Remove all non-numeric characters
  const cleaned = processNumber.replace(/\D/g, '')

  // Format as: NNNNNNN-DD.AAAA.J.TT.OOOO
  if (cleaned.length === 20) {
    return cleaned.replace(
      /(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})(\d{4})/,
      '$1-$2.$3.$4.$5.$6'
    )
  }

  return processNumber
}

/**
 * Validate Brazilian process number (CNJ format)
 */
export function validateProcessNumber(processNumber: string): boolean {
  const cleaned = processNumber.replace(/\D/g, '')
  return cleaned.length === 20
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Debounce function
 */
export function debounce<TFunc extends (...args: any[]) => any>(
  func: TFunc,
  wait: number
): (...args: Parameters<TFunc>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<TFunc>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

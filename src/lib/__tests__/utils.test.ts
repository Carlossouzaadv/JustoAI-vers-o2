import {
  cn,
  formatDate,
  validateEmail,
  generateSlug,
  formatProcessNumber,
  validateProcessNumber,
  truncate,
  sleep,
  debounce,
} from '../utils'

describe('Utils Library', () => {
  describe('cn', () => {
    it('merges class names correctly', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('handles conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
    })

    it('merges tailwind classes correctly', () => {
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
    })
  })

  describe('formatDate', () => {
    it('formats date correctly', () => {
      const date = new Date('2024-01-15T12:00:00Z')
      const formatted = formatDate(date)
      expect(formatted).toMatch(/\d{2}\/01\/2024/)
    })

    it('handles string dates', () => {
      const formatted = formatDate('2024-01-15T12:00:00Z')
      expect(formatted).toMatch(/\d{2}\/01\/2024/)
    })

    it('handles null date', () => {
      expect(formatDate(null)).toBe('Data inválida')
    })

    it('handles invalid date string', () => {
      expect(formatDate('invalid-date')).toBe('Data inválida')
    })
  })

  describe('validateEmail', () => {
    it('validates correct email', () => {
      expect(validateEmail('test@example.com')).toBe(true)
      expect(validateEmail('user.name@domain.co.uk')).toBe(true)
    })

    it('rejects invalid email', () => {
      expect(validateEmail('invalid-email')).toBe(false)
      expect(validateEmail('missing@domain')).toBe(false)
      expect(validateEmail('@domain.com')).toBe(false)
      expect(validateEmail('user@')).toBe(false)
    })
  })

  describe('generateSlug', () => {
    it('generates slug from text', () => {
      expect(generateSlug('Hello World Test')).toBe('hello-world-test')
    })

    it('handles special characters', () => {
      expect(generateSlug('Título com Acentos!')).toBe('titulo-com-acentos')
    })

    it('handles multiple spaces', () => {
      expect(generateSlug('Too   many    spaces')).toBe('too-many-spaces')
    })

    it('handles leading/trailing spaces', () => {
      expect(generateSlug('  trimmed  ')).toBe('trimmed')
    })
  })

  describe('formatProcessNumber', () => {
    it('formats valid 20-digit process number', () => {
      const processNumber = '12345678901234567890'
      const formatted = formatProcessNumber(processNumber)
      expect(formatted).toBe('1234567-89.0123.4.56.7890')
    })

    it('formats already formatted number', () => {
      const processNumber = '1234567-89.0123.4.56.7890'
      const formatted = formatProcessNumber(processNumber)
      expect(formatted).toBe('1234567-89.0123.4.56.7890')
    })

    it('returns original for invalid length', () => {
      const processNumber = '123456'
      expect(formatProcessNumber(processNumber)).toBe('123456')
    })
  })

  describe('validateProcessNumber', () => {
    it('validates correct 20-digit number', () => {
      expect(validateProcessNumber('12345678901234567890')).toBe(true)
      expect(validateProcessNumber('1234567-89.0123.4.56.7890')).toBe(true)
    })

    it('rejects invalid length', () => {
      expect(validateProcessNumber('123456')).toBe(false)
      expect(validateProcessNumber('123456789012345678901')).toBe(false)
    })
  })

  describe('truncate', () => {
    it('truncates long text', () => {
      const text = 'This is a very long text that should be truncated'
      expect(truncate(text, 20)).toBe('This is a very long ...')
    })

    it('does not truncate short text', () => {
      const text = 'Short text'
      expect(truncate(text, 20)).toBe('Short text')
    })

    it('handles exact length', () => {
      const text = 'Exactly twenty chars'
      expect(truncate(text, 20)).toBe('Exactly twenty chars')
    })
  })

  describe('sleep', () => {
    it('returns a promise', () => {
      const result = sleep(10)
      expect(result).toBeInstanceOf(Promise)
    })
  })

  describe('debounce', () => {
    jest.useFakeTimers()

    it('debounces function calls', () => {
      const mockFn = jest.fn()
      const debouncedFn = debounce(mockFn, 100)

      debouncedFn()
      debouncedFn()
      debouncedFn()

      expect(mockFn).not.toHaveBeenCalled()

      jest.advanceTimersByTime(100)

      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('passes arguments correctly', () => {
      const mockFn = jest.fn()
      const debouncedFn = debounce(mockFn, 100)

      debouncedFn('arg1', 'arg2')

      jest.advanceTimersByTime(100)

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2')
    })

    afterEach(() => {
      jest.clearAllTimers()
    })
  })
})

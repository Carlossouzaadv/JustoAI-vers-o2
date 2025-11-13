import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from '../use-mobile'

describe('useIsMobile Hook', () => {
  // Mock window.matchMedia
  let matchMediaMock: jest.Mock
  let listeners: ((_event: MediaQueryListEvent) => void)[] = []

  beforeEach(() => {
    listeners = []
    matchMediaMock = jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: jest.fn((_event, handler) => {
        if (_event === 'change') {
          listeners.push(handler)
        }
      }),
      removeEventListener: jest.fn((_event, handler) => {
        if (_event === 'change') {
          listeners = listeners.filter((l) => l !== handler)
        }
      }),
      dispatchEvent: jest.fn(),
    }))

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock,
    })
  })

  afterEach(() => {
    listeners = []
  })

  it('returns false for desktop width', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(false)
  })

  it('returns true for mobile width', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    })

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(true)
  })

  it('returns true for tablet width (767px)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 767,
    })

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(true)
  })

  it('returns false for desktop width (768px)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    })

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(false)
  })

  it('updates when window is resized', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(false)

    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      // Trigger the change event
      listeners.forEach((listener) => {
        listener({} as MediaQueryListEvent)
      })
    })

    expect(result.current).toBe(true)
  })

  it('cleans up event listener on unmount', () => {
    const removeEventListenerSpy = jest.fn()

    matchMediaMock.mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: removeEventListenerSpy,
    }))

    const { unmount } = renderHook(() => useIsMobile())

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalled()
  })
})

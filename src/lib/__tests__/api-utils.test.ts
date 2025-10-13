/**
 * @jest-environment node
 */
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  notFoundResponse,
  methodNotAllowedResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '../api-utils'

describe('API Utils', () => {
  describe('successResponse', () => {
    it('returns success response with default status', async () => {
      const data = { message: 'Success' }
      const response = successResponse(data)
      const json = await response.json()

      expect(response.status).toBe(200)
      expect(json).toEqual(data)
    })

    it('returns success response with custom status', async () => {
      const data = { message: 'Created' }
      const response = successResponse(data, 201)
      const json = await response.json()

      expect(response.status).toBe(201)
      expect(json).toEqual(data)
    })
  })

  describe('errorResponse', () => {
    it('returns error response with default status', async () => {
      const message = 'Error occurred'
      const response = errorResponse(message)
      const json = await response.json()

      expect(response.status).toBe(400)
      expect(json.error).toBe(message)
    })

    it('returns error response with custom status', async () => {
      const message = 'Server error'
      const response = errorResponse(message, 500)

      expect(response.status).toBe(500)
    })

    it('includes details when provided', async () => {
      const message = 'Validation failed'
      const details = { field: 'email', issue: 'invalid format' }
      const response = errorResponse(message, 400, details)
      const json = await response.json()

      expect(json.details).toEqual(details)
    })
  })

  describe('unauthorizedResponse', () => {
    it('returns 401 status', async () => {
      const response = unauthorizedResponse()

      expect(response.status).toBe(401)
    })

    it('uses default message', async () => {
      const response = unauthorizedResponse()
      const json = await response.json()

      expect(json.error).toBe('Não autorizado')
    })

    it('uses custom message', async () => {
      const message = 'Token inválido'
      const response = unauthorizedResponse(message)
      const json = await response.json()

      expect(json.error).toBe(message)
    })
  })

  describe('notFoundResponse', () => {
    it('returns 404 status', async () => {
      const response = notFoundResponse()

      expect(response.status).toBe(404)
    })

    it('uses default message', async () => {
      const response = notFoundResponse()
      const json = await response.json()

      expect(json.error).toBe('Recurso não encontrado')
    })

    it('uses custom message', async () => {
      const message = 'Usuário não encontrado'
      const response = notFoundResponse(message)
      const json = await response.json()

      expect(json.error).toBe(message)
    })
  })

  describe('methodNotAllowedResponse', () => {
    it('returns 405 status', async () => {
      const response = methodNotAllowedResponse(['GET', 'POST'])

      expect(response.status).toBe(405)
    })

    it('includes allowed methods in body', async () => {
      const allowedMethods = ['GET', 'POST']
      const response = methodNotAllowedResponse(allowedMethods)
      const json = await response.json()

      expect(json.allowedMethods).toEqual(allowedMethods)
    })

    it('includes Allow header', async () => {
      const allowedMethods = ['GET', 'POST', 'PUT']
      const response = methodNotAllowedResponse(allowedMethods)

      expect(response.headers.get('Allow')).toBe('GET, POST, PUT')
    })
  })

  describe('validationErrorResponse', () => {
    it('returns 422 status', async () => {
      const errors = { email: ['Email is required'] }
      const response = validationErrorResponse(errors)

      expect(response.status).toBe(422)
    })

    it('includes validation errors', async () => {
      const errors = {
        email: ['Email is required', 'Email must be valid'],
        password: ['Password is too short'],
      }
      const response = validationErrorResponse(errors)
      const json = await response.json()

      expect(json.error).toBe('Erro de validação')
      expect(json.errors).toEqual(errors)
    })
  })

  describe('serverErrorResponse', () => {
    it('returns 500 status', async () => {
      const response = serverErrorResponse()

      expect(response.status).toBe(500)
    })

    it('uses default message', async () => {
      const response = serverErrorResponse()
      const json = await response.json()

      expect(json.error).toBe('Erro interno do servidor')
    })

    it('uses custom message', async () => {
      const message = 'Database connection failed'
      const response = serverErrorResponse(message)
      const json = await response.json()

      expect(json.error).toBe(message)
    })
  })
})

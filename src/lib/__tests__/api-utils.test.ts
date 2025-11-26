/**
 * @jest-environment node
 */
import {
  successResponse,
  errorResponse,
  ApiResponse,
} from '../api-utils'

describe('API Utils', () => {
  describe('successResponse', () => {
    it('returns success response with default status', async () => {
      const data = { message: 'Success' }
      const response = successResponse(data)
      const json = await response.json() as unknown

      // Type guard to safely extract response
      const isSuccessResponse = (val: unknown): val is ApiResponse<typeof data> => {
        return (
          typeof val === 'object' &&
          val !== null &&
          'success' in val &&
          (val as ApiResponse<typeof data>).success === true
        )
      }

      expect(response.status).toBe(200)
      if (isSuccessResponse(json)) {
        expect(json.data).toEqual(data)
      }
    })

    it('returns success response with custom message', async () => {
      const data = { message: 'Created' }
      const message = 'Resource created successfully'
      const response = successResponse(data, message)
      const json = await response.json() as unknown

      const isSuccessResponse = (val: unknown): val is ApiResponse<typeof data> => {
        return (
          typeof val === 'object' &&
          val !== null &&
          'success' in val &&
          (val as ApiResponse<typeof data>).success === true
        )
      }

      expect(response.status).toBe(200)
      if (isSuccessResponse(json)) {
        expect(json.message).toBe(message)
        expect(json.data).toEqual(data)
      }
    })
  })

  describe('errorResponse', () => {
    it('returns _error response with default status (400)', async () => {
      const message = 'Error occurred'
      const response = errorResponse(message)
      const json = await response.json() as unknown

      const isErrorResponse = (val: unknown): val is ApiResponse => {
        return (
          typeof val === 'object' &&
          val !== null &&
          'success' in val &&
          (val as ApiResponse).success === false &&
          '_error' in val
        )
      }

      expect(response.status).toBe(400)
      if (isErrorResponse(json)) {
        expect(json._error).toBe(message)
      }
    })

    it('returns _error response with custom status', async () => {
      const message = 'Server _error'
      const response = errorResponse(message, 500)

      expect(response.status).toBe(500)
    })

    it('returns _error response with 401 status', async () => {
      const message = 'Não autorizado'
      const response = errorResponse(message, 401)

      expect(response.status).toBe(401)
    })

    it('returns _error response with 404 status', async () => {
      const message = 'Recurso não encontrado'
      const response = errorResponse(message, 404)

      expect(response.status).toBe(404)
    })

    it('returns _error response with 405 status', async () => {
      const message = 'Method not allowed'
      const response = errorResponse(message, 405)

      expect(response.status).toBe(405)
    })

    it('returns _error response with 422 status', async () => {
      const message = 'Validation failed'
      const response = errorResponse(message, 422)

      expect(response.status).toBe(422)
    })
  })
})

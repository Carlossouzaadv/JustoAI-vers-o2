import {
  QUOTA_MESSAGES,
  CREDIT_MESSAGES,
  REPORT_MESSAGES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  formatMessage,
  getMessage,
  isValidReportTone,
  formatNumber,
  formatPercentage,
  formatCurrency,
} from '../messages'

describe('Messages Library', () => {
  describe('QUOTA_MESSAGES', () => {
    it('has correct quota status messages', () => {
      expect(QUOTA_MESSAGES.quota_ok).toBe('Dentro do limite mensal')
      expect(QUOTA_MESSAGES.quota_soft_warning).toBe('Você já usou 80% da sua cota mensal')
      expect(QUOTA_MESSAGES.quota_hard_blocked).toBe('Limite mensal atingido')
    })

    it('generates quota usage message', () => {
      expect(QUOTA_MESSAGES.quota_usage(5, 10)).toBe('Você já usou 5 de 10 relatórios neste mês')
    })

    it('generates quota remaining message', () => {
      expect(QUOTA_MESSAGES.quota_remaining(1)).toBe('1 relatório restante')
      expect(QUOTA_MESSAGES.quota_remaining(5)).toBe('5 relatórios restantes')
    })
  })

  describe('CREDIT_MESSAGES', () => {
    it('has correct credit status messages', () => {
      expect(CREDIT_MESSAGES.credits_sufficient).toBe('Créditos suficientes')
      expect(CREDIT_MESSAGES.credits_low).toBe('Créditos baixos')
      expect(CREDIT_MESSAGES.credits_insufficient).toBe('Créditos insuficientes')
    })

    it('generates credits balance message', () => {
      expect(CREDIT_MESSAGES.credits_balance(1)).toBe('1 crédito disponível')
      expect(CREDIT_MESSAGES.credits_balance(10)).toBe('10 créditos disponíveis')
    })

    it('generates insufficient credits description', () => {
      const message = CREDIT_MESSAGES.insufficient_credits_description(5, 2)
      expect(message).toBe('Esta análise requer 5 créditos, mas você tem apenas 2 disponíveis.')
    })
  })

  describe('REPORT_MESSAGES', () => {
    it('has correct report tone options', () => {
      expect(REPORT_MESSAGES.tone_client.label).toBe('Cliente')
      expect(REPORT_MESSAGES.tone_board.label).toBe('Diretoria')
      expect(REPORT_MESSAGES.tone_internal.label).toBe('Uso Interno')
    })

    it('has correct schedule options', () => {
      expect(REPORT_MESSAGES.schedule_immediate).toBe('Gerar Agora')
      expect(REPORT_MESSAGES.schedule_night).toBe('Agendar para Madrugada')
      expect(REPORT_MESSAGES.schedule_next_month).toBe('Agendar para Próximo Mês')
    })

    it('has correct discount messages', () => {
      expect(REPORT_MESSAGES.night_discount).toBe('50% de desconto nos créditos')
    })
  })

  describe('ERROR_MESSAGES', () => {
    it('has correct general _error messages', () => {
      expect(ERROR_MESSAGES.network_error).toBeDefined()
      expect(ERROR_MESSAGES.server_error).toBeDefined()
      expect(ERROR_MESSAGES.permission_denied).toBeDefined()
    })

    it('has correct upload _error messages', () => {
      expect(ERROR_MESSAGES.file_too_large).toBe('Arquivo muito grande. Tamanho máximo: 100MB')
      expect(ERROR_MESSAGES.invalid_format).toBe('Formato de arquivo inválido')
      expect(ERROR_MESSAGES.upload_failed).toBe('Falha no upload. Tente novamente.')
    })
  })

  describe('SUCCESS_MESSAGES', () => {
    it('has correct upload success messages', () => {
      expect(SUCCESS_MESSAGES.upload_success).toBe('Arquivo enviado com sucesso')
      expect(SUCCESS_MESSAGES.analysis_completed).toBe('Análise concluída com sucesso')
    })

    it('generates batch import success message', () => {
      expect(SUCCESS_MESSAGES.batch_import_success(10)).toBe('Importação concluída: 10 processos criados com sucesso')
    })
  })

  describe('formatMessage', () => {
    it('formats message with placeholders', () => {
      const result = formatMessage('Hello {0}, you have {1} messages', 'John', 5)
      expect(result).toBe('Hello John, you have 5 messages')
    })

    it('handles missing arguments', () => {
      const result = formatMessage('Hello {0}, you have {1} messages', 'John')
      expect(result).toBe('Hello John, you have {1} messages')
    })
  })

  describe('getMessage', () => {
    it('gets message from category', () => {
      const message = getMessage('quota', 'quota_ok')
      expect(message).toBe('Dentro do limite mensal')
    })

    it('returns fallback for non-existent key', () => {
      const message = getMessage('quota', 'non_existent_key')
      expect(message).toBe('Mensagem não encontrada')
    })

    it('uses custom fallback', () => {
      const message = getMessage('quota', 'non_existent_key', 'Custom fallback')
      expect(message).toBe('Custom fallback')
    })
  })

  describe('isValidReportTone', () => {
    it('validates correct tone', () => {
      expect(isValidReportTone('client')).toBe(true)
      expect(isValidReportTone('board')).toBe(true)
      expect(isValidReportTone('internal')).toBe(true)
    })

    it('rejects invalid tone', () => {
      expect(isValidReportTone('invalid')).toBe(false)
      expect(isValidReportTone('')).toBe(false)
    })
  })

  describe('formatNumber', () => {
    it('formats number correctly', () => {
      expect(formatNumber(1000)).toBe('1.000')
      expect(formatNumber(1000000)).toBe('1.000.000')
    })
  })

  describe('formatPercentage', () => {
    it('formats percentage correctly', () => {
      expect(formatPercentage(50)).toBe('50,0%')
      expect(formatPercentage(75.5)).toBe('75,5%')
    })
  })

  describe('formatCurrency', () => {
    it('formats currency correctly', () => {
      const formatted = formatCurrency(1000)
      expect(formatted).toContain('1.000')
      expect(formatted).toContain('R$')
    })

    it('formats decimal values', () => {
      const formatted = formatCurrency(99.99)
      expect(formatted).toContain('99,99')
    })
  })
})

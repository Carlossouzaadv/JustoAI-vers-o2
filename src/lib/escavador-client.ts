import axios, { AxiosInstance, AxiosError } from 'axios';
import Bottleneck from 'bottleneck';

// ============================================
// ESCAVADOR API CLIENT
// Substitui completamente o antigo judit-api-client.ts
// ============================================

interface EscavadorConfig {
  apiKey: string;
  baseUrl: string;
  certificadoId?: string;
}

interface AtualizacaoResponse {
  id: string;
  status: string;
}

interface StatusAtualizacao {
  status: 'PENDENTE' | 'PROCESSANDO' | 'SUCESSO' | 'ERRO';
  data?: unknown;
}

interface MovimentacoesResponse {
  movimentacoes: unknown[];
  nextCursor?: string;
}

interface MonitoramentoResponse {
  success: boolean;
  monitoringId?: string;
}

interface ResumoIAResponse {
  resumo: string;
  status: string;
}

export class EscavadorClient {
  private client: AxiosInstance;
  private limiter: Bottleneck;
  private config: EscavadorConfig;

  constructor(config?: Partial<EscavadorConfig>) {
    this.config = {
      apiKey: config?.apiKey || process.env.ESCAVADOR_API_KEY || '',
      baseUrl: config?.baseUrl || process.env.ESCAVADOR_BASE_URL || 'https://api.escavador.com/api/v2',
      certificadoId: config?.certificadoId || process.env.ESCAVADOR_CERTIFICADO_ID
    };

    // Rate limiter: 500 req/min = 1 req a cada 120ms
    this.limiter = new Bottleneck({
      reservoir: 500,
      reservoirRefreshAmount: 500,
      reservoirRefreshInterval: 60 * 1000,
      minTime: 120
    });

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 60000
    });

    this.setupInterceptors();
  }

  // ==================== ONBOARDING ====================

  /**
   * PASSO 1: Solicitar atualização do processo
   * Custo: R$ 0 (grátis, mas obrigatório antes de buscar autos)
   */
  async solicitarAtualizacao(cnj: string, options?: {
    buscarAutos?: boolean;
    usarCertificado?: boolean;
    documentosEspecificos?: 'INICIAIS' | 'TODOS';
    sendCallback?: boolean;
  }): Promise<AtualizacaoResponse> {
    const body: Record<string, unknown> = {
      autos: options?.buscarAutos ? 1 : 0,
      utilizar_certificado: options?.usarCertificado ? 1 : 0,
      certificado_id: this.config.certificadoId
    };
    
    // Adicionar parâmetros opcionais
    if (options?.documentosEspecificos) {
      body.documentos_especificos = options.documentosEspecificos;
    }
    
    if (options?.sendCallback) {
      body.enviar_callback = 1;
    }

    const response = await this.limiter.schedule(() =>
      this.client.post(`/processos/numero_cnj/${cnj}/solicitar-atualizacao`, body)
    );

    return {
      id: response.data.id,
      status: response.data.status
    };
  }

  /**
   * PASSO 2: Verificar status da atualização
   */
  async consultarStatusAtualizacao(cnj: string): Promise<StatusAtualizacao> {
    const response = await this.limiter.schedule(() =>
      this.client.get(`/processos/numero_cnj/${cnj}/status-atualizacao`)
    );

    return response.data;
  }

  /**
   * PASSO 3: Buscar dados completos do processo
   * Custo: R$ 0,10 (capa + movimentações)
   */
  async buscarProcesso(cnj: string): Promise<unknown> {
    const response = await this.limiter.schedule(() =>
      this.client.get(`/processos/numero_cnj/${cnj}`)
    );

    return response.data;
  }

  /**
   * PASSO 4: Buscar movimentações (paginadas)
   */
  async buscarMovimentacoes(cnj: string, cursor?: string): Promise<MovimentacoesResponse> {
    const url = cursor || `/processos/numero_cnj/${cnj}/movimentacoes`;
    
    const response = await this.limiter.schedule(() =>
      this.client.get(url)
    );

    return {
      movimentacoes: response.data.data || [],
      nextCursor: response.data.links?.next
    };
  }

  /**
   * PASSO 5: Buscar autos (documentos)
   * Custo: R$ 1,40 (busca completa) ou R$ 0,10 (só públicos)
   */
  async buscarAutos(cnj: string, options?: {
    usarCertificado?: boolean;
    tipoDocumentos?: 'TODOS' | 'PUBLICOS' | 'INICIAIS';
  }): Promise<unknown[]> {
    const response = await this.limiter.schedule(() =>
      this.client.get(`/processos/numero_cnj/${cnj}/autos`, {
        params: {
          utilizar_certificado: options?.usarCertificado ? 1 : 0,
          certificado_id: this.config.certificadoId,
          tipo_documentos: options?.tipoDocumentos || 'INICIAIS'
        }
      })
    );

    return response.data.data || [];
  }

  /**
   * PASSO 6: Solicitar resumo IA (EscavAI)
   * Custo: R$ 0,05
   */
  async solicitarResumoIA(cnj: string): Promise<{ id: string }> {
    const response = await this.limiter.schedule(() =>
      this.client.post(`/processos/numero_cnj/${cnj}/resumo-inteligente`)
    );

    return { id: response.data.id };
  }

  async buscarResumoIA(cnj: string): Promise<ResumoIAResponse> {
    const response = await this.limiter.schedule(() =>
      this.client.get(`/processos/numero_cnj/${cnj}/resumo-inteligente`)
    );

    return response.data;
  }

  // ==================== MONITORAMENTO ====================

  /**
   * Configurar monitoramento
   * Custo: R$ 1,42/mês (diário) ou R$ 0,26/mês (semanal)
   */
  async configurarMonitoramento(cnj: string, frequencia: 'DIARIA' | 'SEMANAL'): Promise<MonitoramentoResponse> {
    const response = await this.limiter.schedule(() =>
      this.client.post(`/processos/numero_cnj/${cnj}/monitoramento`, {
        frequencia,
        callback_url: process.env.NEXT_PUBLIC_APP_URL + '/api/webhooks/escavador'
      })
    );

    return {
      success: response.status === 200,
      monitoringId: response.data.id
    };
  }

  async atualizarFrequenciaMonitoramento(
    cnj: string,
    novaFrequencia: 'DIARIA' | 'SEMANAL'
  ): Promise<void> {
    await this.limiter.schedule(() =>
      this.client.put(`/processos/numero_cnj/${cnj}/monitoramento`, {
        frequencia: novaFrequencia
      })
    );
  }

  async removerMonitoramento(cnj: string): Promise<void> {
    await this.limiter.schedule(() =>
      this.client.delete(`/processos/numero_cnj/${cnj}/monitoramento`)
    );
  }

  /**
   * Listar processos monitorados
   */
  async listarMonitoramentos(): Promise<unknown[]> {
    const response = await this.limiter.schedule(() =>
      this.client.get('/monitoramentos')
    );

    return response.data.data || [];
  }

  // ==================== DOWNLOADS ====================

  async downloadDocumento(documentoId: string): Promise<Buffer> {
    const response = await this.limiter.schedule(() =>
      this.client.get(`/documentos/${documentoId}/download`, {
        responseType: 'arraybuffer'
      })
    );

    return Buffer.from(response.data);
  }

  // ==================== HELPERS PRIVADOS ====================

  private setupInterceptors(): void {
    // Logging
    this.client.interceptors.request.use(req => {
      console.log(`[Escavador] ${req.method?.toUpperCase()} ${req.url}`);
      return req;
    });

    // Error handling
    this.client.interceptors.response.use(
      res => res,
      (error: AxiosError) => {
        if (error.response?.status === 429) {
          console.error('[Escavador] Rate limit excedido');
          throw new Error('Escavador rate limit excedido');
        }
        
        if (error.response?.status === 401) {
          console.error('[Escavador] API key inválida');
          throw new Error('Escavador API key inválida');
        }

        if (error.response?.status === 404) {
          console.error('[Escavador] Processo não encontrado');
          throw new Error('Processo não encontrado no Escavador');
        }

        console.error(`[Escavador] Erro: ${error.message}`);
        throw new Error(`Escavador erro: ${error.message}`);
      }
    );
  }

  /**
   * Verifica se o cliente está configurado corretamente
   */
  isConfigured(): boolean {
    return !!this.config.apiKey && this.config.apiKey !== 'sua_chave_aqui';
  }
}

// Singleton para uso global
export const escavadorClient = new EscavadorClient();

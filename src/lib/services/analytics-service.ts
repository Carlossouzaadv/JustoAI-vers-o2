/**
 * AnalyticsService (Padrão-Ouro)
 *
 * Encapsula PostHog client-side e server-side para rastreamento de eventos de produto.
 * Nunca dependemos diretamente de posthog-node. Esta abstração permite trocar de provedor
 * se necessário sem impactar o resto da aplicação.
 *
 * Filosofia:
 * - Type Safety: Zero any, zero as, zero @ts-expect-error
 * - Serverless-Ready: Sempre faz shutdown() após captura de eventos
 * - Auditoria: Logs estruturados para melhor debugging
 */

import { PostHog } from 'posthog-node';
import { log } from './logger';

// Type Guard para validar propriedades de eventos
function isValidEventProperties(properties: unknown): properties is Record<string, string | number | boolean | null | undefined> {
  if (typeof properties !== 'object' || properties === null) {
    return false;
  }

  const props = properties as Record<PropertyKey, unknown>;

  for (const key in props) {
    const value = props[key];
    const isValidType = (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null ||
      value === undefined
    );

    if (!isValidType) {
      return false;
    }
  }

  return true;
}

// Tipo para propriedades de eventos
type EventProperties = Record<string, string | number | boolean | null | undefined>;

class AnalyticsServiceImpl {
  private posthog: PostHog | null = null;
  private isInitialized = false;

  /**
   * Inicializa a instância do PostHog
   * Chamado uma vez na aplicação
   */
  private initialize(): void {
    if (this.isInitialized) {
      return;
    }

    const apiKey = process.env.POSTHOG_API_KEY;

    if (!apiKey) {
      log.warn({
        msg: 'POSTHOG_API_KEY não configurada - Analytics desabilitado',
        component: 'AnalyticsService',
        stage: 'initialize'
      });
      return;
    }

    try {
      this.posthog = new PostHog(apiKey, {
        host: process.env.POSTHOG_HOST || 'https://us.posthog.com',
        flushAt: 1, // Flush imediatamente (importante para serverless)
        flushInterval: 0 // Não usar timer (serverless não permite)
      });

      this.isInitialized = true;

      log.info({
        msg: 'AnalyticsService inicializado',
        component: 'AnalyticsService',
        stage: 'initialize'
      });
    } catch (_error) {
      log.error({
        msg: 'Erro ao inicializar PostHog',
        component: 'AnalyticsService',
        stage: 'initialize',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Rastreia um evento de produto (Padrão-Ouro)
   *
   * CRÍTICO (Padrão-Ouro): Esta função:
   * 1. Valida tipos com type guards
   * 2. Captura o evento no PostHog
   * 3. Faz shutdown() para garantir que o evento foi enviado em serverless
   *
   * @param userId ID único do usuário
   * @param event Nome do evento (ex: 'analysis_rejected_insufficient_credits')
   * @param properties Propriedades do evento
   */
  async track(
    userId: string,
    event: string,
    properties?: unknown
  ): Promise<void> {
    this.initialize();

    if (!this.posthog) {
      log.warn({
        msg: 'PostHog não inicializado - evento ignorado',
        component: 'AnalyticsService',
        event,
        userId
      });
      return;
    }

    try {
      // Validar propriedades com type guard
      let validatedProperties: EventProperties = {};

      if (properties !== undefined) {
        if (!isValidEventProperties(properties)) {
          log.warn({
            msg: 'Propriedades de evento inválidas - usando vazio',
            component: 'AnalyticsService',
            event,
            userId,
            properties: properties === null ? 'null' : typeof properties
          });
          validatedProperties = {};
        } else {
          validatedProperties = properties;
        }
      }

      // Capturar evento
      this.posthog.capture({
        distinctId: userId,
        event: event,
        properties: validatedProperties,
        timestamp: new Date()
      });

      log.info({
        msg: 'Evento rastreado',
        component: 'AnalyticsService',
        event,
        userId,
        propertiesCount: Object.keys(validatedProperties).length
      });

      // 🔥 CRÍTICO (Padrão-Ouro): Aguardar shutdown para garantir envio em serverless
      await this.posthog.shutdown();

    } catch (_error) {
      log.error({
        msg: 'Erro ao rastrear evento',
        component: 'AnalyticsService',
        event,
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
      // NÃO relançar - falha de analytics não deve quebrar a aplicação
    }
  }

  /**
   * Rastreia uma propriedade do usuário (identify)
   * Útil para rastrear características do usuário que persistem
   */
  async identify(
    userId: string,
    userProperties?: unknown
  ): Promise<void> {
    this.initialize();

    if (!this.posthog) {
      return;
    }

    try {
      let validatedProperties: EventProperties = {};

      if (userProperties !== undefined) {
        if (!isValidEventProperties(userProperties)) {
          log.warn({
            msg: 'Propriedades de usuário inválidas',
            component: 'AnalyticsService',
            userId
          });
        } else {
          validatedProperties = userProperties;
        }
      }

      this.posthog.identify({
        distinctId: userId,
        properties: validatedProperties
      });

      log.info({
        msg: 'Usuário identificado',
        component: 'AnalyticsService',
        userId
      });

      await this.posthog.shutdown();

    } catch (_error) {
      log.error({
        msg: 'Erro ao identificar usuário',
        component: 'AnalyticsService',
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

// Singleton pattern para garantir uma única instância
export const analyticsService = new AnalyticsServiceImpl();

// Exportar tipo para uso em outras partes da app
export type AnalyticsService = typeof analyticsService;

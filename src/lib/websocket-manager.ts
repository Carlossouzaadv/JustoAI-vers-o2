
// ================================================================
// WEBSOCKET MANAGER - Progresso em Tempo Real
// ================================================================
// Gerencia conexões WebSocket para atualizações de progresso

import { ICONS } from './icons';

export interface WebSocketMessage {
  type:
    | 'batch_progress'      // Progresso de importação/batch
    | 'batch_completed'     // Batch concluído
    | 'batch_error'         // Erro em batch
    | 'process:updated'     // Processo foi atualizado
    | 'movement:added'      // Nova movimentação via webhook
    | 'report:ready'        // Relatório pronto para download
    | 'status:changed'      // Status do processo mudou
    | 'alert:notification'  // Alerta geral
    | 'ping'                // Keep-alive
    | 'pong';               // Keep-alive response
  batchId?: string;
  processId?: string;
  workspaceId?: string;
  data?: unknown;
  timestamp: number;
}

export interface BatchProgressMessage {
  batchId: string;
  totalRows: number;
  processed: number;
  successful: number;
  failed: number;
  progress: number; // 0-100
  status: string;
  currentPage?: number;
  totalPages?: number;
  estimatedTimeRemaining?: number;
  lastUpdate: string;
}

/**
 * Gerenciador de WebSocket Server-side
 * Para Next.js, usaremos Server-Sent Events (SSE) como alternativa
 */
export class WebSocketManager {
  private connections: Map<string, Response> = new Map();
  private batchSubscriptions: Map<string, Set<string>> = new Map();
  private workspaceSubscriptions: Map<string, Set<string>> = new Map(); // workspace -> connections
  private connectionWorkspaces: Map<string, string> = new Map(); // connection -> workspace
  private pingInterval?: NodeJS.Timeout;

  constructor() {
    this.startPingInterval();
  }

  /**
   * Registra nova conexão SSE
   */
  addConnection(connectionId: string, response: Response, workspaceId?: string): void {
    this.connections.set(connectionId, response);
    if (workspaceId) {
      this.connectionWorkspaces.set(connectionId, workspaceId);

      // Adicionar à subscrição de workspace
      if (!this.workspaceSubscriptions.has(workspaceId)) {
        this.workspaceSubscriptions.set(workspaceId, new Set());
      }
      this.workspaceSubscriptions.get(workspaceId)!.add(connectionId);
    }

    console.log(`${ICONS.SUCCESS} Nova conexão SSE: ${connectionId}${workspaceId ? ` (workspace: ${workspaceId})` : ''}`);

    // Enviar confirmação de conexão
    this.sendMessage(connectionId, {
      type: 'ping',
      timestamp: Date.now()
    });
  }

  /**
   * Remove conexão
   */
  removeConnection(connectionId: string): void {
    // Remover de todas as subscrições de batch
    for (const [batchId, subscribers] of this.batchSubscriptions) {
      subscribers.delete(connectionId);
      if (subscribers.size === 0) {
        this.batchSubscriptions.delete(batchId);
      }
    }

    // Remover de subscrição de workspace
    const workspaceId = this.connectionWorkspaces.get(connectionId);
    if (workspaceId) {
      const subscribers = this.workspaceSubscriptions.get(workspaceId);
      if (subscribers) {
        subscribers.delete(connectionId);
        if (subscribers.size === 0) {
          this.workspaceSubscriptions.delete(workspaceId);
        }
      }
      this.connectionWorkspaces.delete(connectionId);
    }

    this.connections.delete(connectionId);
    console.log(`${ICONS.INFO} Conexão SSE removida: ${connectionId}`);
  }

  /**
   * Subscreve conexão a atualizações de um workspace específico
   */
  subscribeToWorkspace(connectionId: string, workspaceId: string): void {
    if (!this.workspaceSubscriptions.has(workspaceId)) {
      this.workspaceSubscriptions.set(workspaceId, new Set());
    }

    this.workspaceSubscriptions.get(workspaceId)!.add(connectionId);
    this.connectionWorkspaces.set(connectionId, workspaceId);

    console.log(`${ICONS.SUCCESS} Conexão ${connectionId} subscrita ao workspace ${workspaceId}`);
  }

  /**
   * Remove subscrição de um workspace
   */
  unsubscribeFromWorkspace(connectionId: string, workspaceId: string): void {
    const subscribers = this.workspaceSubscriptions.get(workspaceId);
    if (subscribers) {
      subscribers.delete(connectionId);
      if (subscribers.size === 0) {
        this.workspaceSubscriptions.delete(workspaceId);
      }
    }
  }

  /**
   * Subscreve conexão a atualizações de um batch
   */
  subscribeToBatch(connectionId: string, batchId: string): void {
    if (!this.batchSubscriptions.has(batchId)) {
      this.batchSubscriptions.set(batchId, new Set());
    }

    this.batchSubscriptions.get(batchId)!.add(connectionId);
    console.log(`${ICONS.SUCCESS} Conexão ${connectionId} subscrita ao batch ${batchId}`);
  }

  /**
   * Remove subscrição de um batch
   */
  unsubscribeFromBatch(connectionId: string, batchId: string): void {
    const subscribers = this.batchSubscriptions.get(batchId);
    if (subscribers) {
      subscribers.delete(connectionId);
      if (subscribers.size === 0) {
        this.batchSubscriptions.delete(batchId);
      }
    }
  }

  /**
   * Envia progresso do batch para todos os subscritos
   */
  broadcastBatchProgress(batchId: string, progress: BatchProgressMessage): void {
    const subscribers = this.batchSubscriptions.get(batchId);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const message: WebSocketMessage = {
      type: 'batch_progress',
      batchId,
      data: progress,
      timestamp: Date.now()
    };

    console.log(`${ICONS.PROCESS} Broadcasting progresso do batch ${batchId} para ${subscribers.size} conexões`);

    for (const connectionId of subscribers) {
      this.sendMessage(connectionId, message);
    }
  }

  /**
   * Notifica conclusão do batch
   */
  broadcastBatchCompleted(batchId: string, finalStatus: unknown): void {
    const subscribers = this.batchSubscriptions.get(batchId);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const message: WebSocketMessage = {
      type: 'batch_completed',
      batchId,
      data: finalStatus,
      timestamp: Date.now()
    };

    console.log(`${ICONS.SUCCESS} Broadcasting conclusão do batch ${batchId}`);

    for (const connectionId of subscribers) {
      this.sendMessage(connectionId, message);
    }

    // Limpar subscrições do batch concluído
    this.batchSubscriptions.delete(batchId);
  }

  /**
   * Notifica erro no batch
   */
  broadcastBatchError(batchId: string, error: string): void {
    const subscribers = this.batchSubscriptions.get(batchId);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const message: WebSocketMessage = {
      type: 'batch_error',
      batchId,
      data: { error },
      timestamp: Date.now()
    };

    console.log(`${ICONS.ERROR} Broadcasting erro do batch ${batchId}`);

    for (const connectionId of subscribers) {
      this.sendMessage(connectionId, message);
    }
  }

  /**
   * Broadcast para todos os usuários de um workspace
   */
  broadcastToWorkspace(workspaceId: string, message: Omit<WebSocketMessage, 'timestamp'>): void {
    const subscribers = this.workspaceSubscriptions.get(workspaceId);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const fullMessage: WebSocketMessage = {
      ...message,
      workspaceId,
      timestamp: Date.now()
    };

    console.log(`${ICONS.PROCESS} Broadcasting para workspace ${workspaceId} (${subscribers.size} conexões): ${message.type}`);

    for (const connectionId of subscribers) {
      this.sendMessage(connectionId, fullMessage);
    }
  }

  /**
   * Broadcast de evento específico de processo para workspace
   */
  broadcastProcessEvent(workspaceId: string, processId: string, eventType: string, data: unknown): void {
    // Validar se eventType é um tipo válido de mensagem
    const validTypes: Array<WebSocketMessage['type']> = [
      'process:updated',
      'movement:added',
      'report:ready',
      'status:changed',
      'alert:notification'
    ];

    const messageType = (validTypes.includes(eventType as WebSocketMessage['type']))
      ? (eventType as WebSocketMessage['type'])
      : 'process:updated';

    this.broadcastToWorkspace(workspaceId, {
      type: messageType,
      processId,
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Type guard para verificar se a response tem método write
   */
  private hasWriteMethod(obj: unknown): obj is { write: (data: string) => void } {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'write' in obj &&
      typeof (obj as Record<string, unknown>).write === 'function'
    );
  }

  /**
   * Envia mensagem para conexão específica
   */
  private sendMessage(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.log(`${ICONS.WARNING} Conexão ${connectionId} não encontrada`);
      return;
    }

    try {
      // Formatar como SSE (Server-Sent Events)
      // Formato: data: {json}\n\n
      const sseData = `data: ${JSON.stringify(message)}\n\n`;

      // Enviar para cliente via Response
      // Em Next.js, a response é um ReadableStream que permite escrita
      if (this.hasWriteMethod(connection)) {
        connection.write(sseData);
      } else {
        // Fallback: tentar enviar como json se não for SSE puro
        console.log(`${ICONS.INFO} Conexão ${connectionId} não suporta escrita direta`);
      }

      console.log(`${ICONS.SUCCESS} Mensagem SSE enviada para ${connectionId}: ${message.type}`);

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao enviar mensagem para ${connectionId}:`, error);
      this.removeConnection(connectionId);
    }
  }

  /**
   * Inicia ping periódico para manter conexões vivas
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const pingMessage: WebSocketMessage = {
        type: 'ping',
        timestamp: Date.now()
      };

      // Enviar ping para todas as conexões
      for (const connectionId of this.connections.keys()) {
        this.sendMessage(connectionId, pingMessage);
      }

    }, 30000); // Ping a cada 30 segundos
  }

  /**
   * Para o ping interval
   */
  stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }

  /**
   * Obtém estatísticas das conexões
   */
  getStats(): unknown {
    const batchStats = Array.from(this.batchSubscriptions.entries()).map(([batchId, subscribers]) => ({
      batchId,
      subscribers: subscribers.size
    }));

    const workspaceStats = Array.from(this.workspaceSubscriptions.entries()).map(([workspaceId, subscribers]) => ({
      workspaceId,
      subscribers: subscribers.size
    }));

    return {
      totalConnections: this.connections.size,
      activeBatches: this.batchSubscriptions.size,
      activeWorkspaces: this.workspaceSubscriptions.size,
      batchStats,
      workspaceStats
    };
  }

  /**
   * Limpa todas as conexões (shutdown)
   */
  cleanup(): void {
    this.stopPingInterval();
    this.connections.clear();
    this.batchSubscriptions.clear();
    console.log(`${ICONS.INFO} WebSocket Manager cleanup concluído`);
  }
}

// Singleton global
let wsManager: WebSocketManager | null = null;

export function getWebSocketManager(): WebSocketManager {
  if (!wsManager) {
    wsManager = new WebSocketManager();
  }
  return wsManager;
}

// Função auxiliar para gerar IDs únicos de conexão
export function generateConnectionId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
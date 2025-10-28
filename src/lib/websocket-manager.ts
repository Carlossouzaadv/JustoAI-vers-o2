/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
// ================================================================
// WEBSOCKET MANAGER - Progresso em Tempo Real
// ================================================================
// Gerencia conexões WebSocket para atualizações de progresso

import { ICONS } from './icons';

export interface WebSocketMessage {
  type: 'batch_progress' | 'batch_completed' | 'batch_error' | 'ping' | 'pong';
  batchId?: string;
  data?: any;
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
  private pingInterval?: NodeJS.Timeout;

  constructor() {
    this.startPingInterval();
  }

  /**
   * Registra nova conexão SSE
   */
  addConnection(connectionId: string, response: Response): void {
    this.connections.set(connectionId, response);
    console.log(`${ICONS.SUCCESS} Nova conexão WebSocket: ${connectionId}`);

    // Enviar ping inicial
    this.sendMessage(connectionId, {
      type: 'ping',
      timestamp: Date.now()
    });
  }

  /**
   * Remove conexão
   */
  removeConnection(connectionId: string): void {
    // Remover de todas as subscrições
    for (const [batchId, subscribers] of this.batchSubscriptions) {
      subscribers.delete(connectionId);
      if (subscribers.size === 0) {
        this.batchSubscriptions.delete(batchId);
      }
    }

    this.connections.delete(connectionId);
    console.log(`${ICONS.INFO} Conexão WebSocket removida: ${connectionId}`);
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
  broadcastBatchCompleted(batchId: string, finalStatus: any): void {
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
   * Envia mensagem para conexão específica
   */
  private sendMessage(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.log(`${ICONS.WARNING} Conexão ${connectionId} não encontrada`);
      return;
    }

    try {
      // TODO: Implementar envio real via SSE
      // const sseData = `data: ${JSON.stringify(message)}\n\n`;
      // connection.write(sseData);

      console.log(`${ICONS.SUCCESS} Mensagem enviada para ${connectionId}: ${message.type}`);

    } catch {
      console.error(`${ICONS.ERROR} Erro ao enviar mensagem para ${connectionId}`);
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
  getStats(): any {
    const batchStats = Array.from(this.batchSubscriptions.entries()).map(([batchId, subscribers]) => ({
      batchId,
      subscribers: subscribers.size
    }));

    return {
      totalConnections: this.connections.size,
      activeBatches: this.batchSubscriptions.size,
      batchStats
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
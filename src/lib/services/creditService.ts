/**
 * Serviço de Créditos (MOCK para Testes)
 *
 * Este serviço é mockado no momento para facilitar testes.
 * Sempre retorna créditos suficientes.
 *
 * IMPORTANTE: Quando implementar de verdade, substituir por queries Prisma reais.
 */

export interface CreditsCheckResult {
  available: boolean;
  balance: number;
  required: number;
  message?: string;
}

export interface CreditsDebitResult {
  success: boolean;
  newBalance: number;
  transactionId?: string;
}

export interface CreditsBalance {
  fullCreditsBalance: number;
  reportCreditsBalance: number;
  totalBalance: number;
  includedCredits?: number;
  purchasedCredits?: number;
  consumedCredits?: number;
}

/**
 * MOCK: Sempre retorna créditos suficientes
 * Quando for implementar de verdade, fazer query real no banco
 */
export const creditService = {
  /**
   * Verifica se workspace tem créditos suficientes
   * @param workspaceId ID do workspace
   * @param amount Quantidade de créditos a verificar
   * @param category Categoria (FULL ou REPORT)
   */
  async checkCredits(
    workspaceId: string,
    amount: number,
    category: 'FULL' | 'REPORT'
  ): Promise<CreditsCheckResult> {
    console.log(
      `[CREDIT_CHECK][MOCK] workspace=${workspaceId}, amount=${amount}, category=${category}`
    );

    // MOCK: Sempre retorna créditos suficientes
    return {
      available: true,
      balance: 999,
      required: amount,
      message: 'Créditos suficientes (mock)'
    };

    // TODO: Quando implementar de verdade:
    // const workspace = await prisma.workspaceCredits.findUnique({
    //   where: { workspaceId }
    // });
    // const balance = category === 'FULL'
    //   ? workspace?.fullCreditsBalance
    //   : workspace?.reportCreditsBalance;
    // return {
    //   available: (balance ?? 0) >= amount,
    //   balance: balance ?? 0,
    //   required: amount
    // };
  },

  /**
   * Debita créditos do workspace (registra transação)
   * @param workspaceId ID do workspace
   * @param amount Quantidade a debitar
   * @param category Categoria (FULL ou REPORT)
   * @param metadata Informações adicionais da transação
   */
  async debitCredits(
    workspaceId: string,
    amount: number,
    category: 'FULL' | 'REPORT',
    metadata: Record<string, unknown>
  ): Promise<CreditsDebitResult> {
    console.log(
      `[CREDIT_DEBIT][MOCK] workspace=${workspaceId}, amount=${amount}, category=${category}`,
      metadata
    );

    // MOCK: Só loga, não faz nada
    return {
      success: true,
      newBalance: 999,
      transactionId: `mock-${Date.now()}`
    };

    // TODO: Quando implementar de verdade:
    // return await prisma.$transaction(async (tx) => {
    //   // Atualizar saldo
    //   const updated = await tx.workspaceCredits.update({
    //     where: { workspaceId },
    //     data: {
    //       [category === 'FULL' ? 'fullCreditsBalance' : 'reportCreditsBalance']: {
    //         decrement: amount
    //       }
    //     }
    //   });
    //
    //   // Registrar transação
    //   await tx.creditTransaction.create({
    //     data: {
    //       workspaceId,
    //       type: 'DEBIT',
    //       creditCategory: category,
    //       amount: new Decimal(amount),
    //       reason: metadata.reason || 'Service usage',
    //       metadata
    //     }
    //   });
    //
    //   return {
    //     success: true,
    //     newBalance: category === 'FULL'
    //       ? updated.fullCreditsBalance
    //       : updated.reportCreditsBalance
    //   };
    // });
  },

  /**
   * Retorna saldo atual de créditos
   * @param workspaceId ID do workspace
   */
  async getBalance(workspaceId: string): Promise<CreditsBalance> {
    console.log(`[CREDIT_BALANCE][MOCK] workspace=${workspaceId}`);

    // MOCK: Sempre retorna saldo alto
    return {
      fullCreditsBalance: 999,
      reportCreditsBalance: 999,
      totalBalance: 1998,
      includedCredits: 999,
      purchasedCredits: 0,
      consumedCredits: 0
    };

    // TODO: Quando implementar de verdade:
    // const workspace = await prisma.workspaceCredits.findUnique({
    //   where: { workspaceId }
    // });
    // return {
    //   fullCreditsBalance: workspace?.fullCreditsBalance ?? 0,
    //   reportCreditsBalance: workspace?.reportCreditsBalance ?? 0,
    //   totalBalance: (workspace?.fullCreditsBalance ?? 0) + (workspace?.reportCreditsBalance ?? 0),
    //   includedCredits: 0,
    //   purchasedCredits: 0,
    //   consumedCredits: 0
    // };
  },

  /**
   * Retorna informações formatadas para UI
   * @param workspaceId ID do workspace
   */
  async getFormattedBalance(workspaceId: string) {
    const balance = await this.getBalance(workspaceId);

    return {
      balance: {
        fullCreditsBalance: balance.fullCreditsBalance,
        reportCreditsBalance: balance.reportCreditsBalance,
        includedCredits: balance.includedCredits || 999,
        purchasedCredits: balance.purchasedCredits || 0,
        consumedCredits: balance.consumedCredits || 0,
        renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        monthlyLimit: 999,
        monthlyUsed: 0,
        monthlyPercentage: 0
      }
    };
  }
};

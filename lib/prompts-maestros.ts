// ================================================================
// PROMPTS MAESTROS DO SISTEMA JUSTOAI V2
// ================================================================
// Biblioteca centralizada de prompts otimizados para análise multi-frentes
// de processos judiciais complexos

import { ModelTier } from './ai-model-router';

/**
 * Interface para respostas de análise multi-frentes
 */
export interface MultiFrontAnalysisResponse {
  frentes_discussao: FrenteDiscussao[];
  resumo_executivo_frentes: string;
  calendario_acoes_prioritarias: AcaoPrioritaria[];
  indicadores_quantitativos: IndicadoresQuantitativos;
  alertas_urgencia: AlertaUrgencia[];
}

export interface FrenteDiscussao {
  nome_frente: string;
  status_atual: string;
  proximos_passos: string;
  prazos_correndo: {
    existe_prazo: boolean;
    parte_responsavel: string | null;
    acao_prazo: string | null;
    data_limite: string | null;
  };
  ultima_movimentacao: {
    data: string;
    tipo: string;
    resumo: string;
  };
  nivel_prioridade: 'Alta' | 'Média' | 'Baixa';
  processos_envolvidos: string[];
}

export interface AcaoPrioritaria {
  data_limite: string;
  acao: string;
  processo: string;
  frente: string;
  prioridade: 'Alta' | 'Média' | 'Baixa';
  responsavel: string;
}

export interface IndicadoresQuantitativos {
  total_processos: number;
  processos_por_frente: Record<string, number>;
  valores_totais: Record<string, number>;
  alertas_urgencia: number;
  prazos_proximos_30_dias: number;
}

export interface AlertaUrgencia {
  tipo: 'prazo_fatal' | 'decisao_iminente' | 'recurso_vencendo' | 'execucao_critica';
  processo: string;
  frente: string;
  descricao: string;
  data_limite: string;
  nivel: 'Crítico' | 'Alto' | 'Médio';
}

/**
 * Classe para gerenciar prompts maestros do sistema
 */
export class PromptsMaestros {

  /**
   * PROMPT MAESTRO 1: Análise Multi-Frentes de Processo Individual
   *
   * Baseado nos exemplos fornecidos:
   * "Com base em todo o documento anexo, resuma os principais andamentos recentes do processo 5080281-82.2020.4.02.5101.
   * Organize a resposta por frentes de discussão..."
   */
  static getAnaliseMultiFrentesIndividual(
    numeroProcesso: string,
    tier: ModelTier = ModelTier.BALANCED
  ): string {
    return `Você é um especialista em análise jurídica de processos complexos. Sua expertise é identificar e organizar múltiplas frentes de discussão que ocorrem simultaneamente em processos judiciais.

=== ANÁLISE MULTI-FRENTES - PROCESSO INDIVIDUAL ===

PROCESSO: ${numeroProcesso}

OBJETIVO:
Processos judiciais complexos frequentemente têm mais de uma questão acontecendo ao mesmo tempo. Não é possível tratar o processo como se tivesse um único "próximo passo", quando na verdade podem haver diversas frentes paralelas.

INSTRUÇÕES ESPECÍFICAS:
1. Analise TODO o documento anexo e identifique as diferentes frentes de discussão ativas
2. Para cada frente identificada, determine:
   - O status atual (ex: aguardando decisão, suspenso, etc.)
   - Os próximos passos esperados
   - Se há algum prazo correndo para qualquer uma das partes, especificando o ato a ser praticado
   - Última movimentação relevante para essa frente específica

FRENTES COMUNS A IDENTIFICAR:
- Mérito principal (discussão de fundo da demanda)
- Execução/cumprimento de sentença
- Recursos em tramitação (apelação, agravo, embargos)
- Medidas cautelares/liminares
- Questões processuais (competência, nulidades, exceções)
- Penhora e avaliação de bens
- Suspensão/sobrestamento
- Perícias e produção de provas
- Incidentes processuais
- Questões recursais superiores (STJ/STF)

ESTRUTURA OBRIGATÓRIA DA RESPOSTA:
Retorne em JSON seguindo exatamente este formato:

{
  "numero_processo": "${numeroProcesso}",
  "resumo_geral": "Panorama executivo do processo em 2-3 frases",
  "frentes_discussao": [
    {
      "nome_frente": "string - Ex: Execução Principal, Recurso de Apelação, Penhora de Bens",
      "status_atual": "string - Estado específico desta frente",
      "fase_atual": "string - Fase processual específica",
      "proximos_passos": "string - Próximas ações esperadas nesta frente",
      "prazos_correndo": {
        "existe_prazo": boolean,
        "parte_responsavel": "string | null - Qual parte tem prazo correndo",
        "acao_prazo": "string | null - Qual ação deve ser praticada",
        "data_limite": "string | null - Data limite do prazo",
        "consequencia_nao_cumprimento": "string | null"
      },
      "ultima_movimentacao": {
        "data": "string",
        "tipo": "string",
        "resumo": "string - Resumo da última movimentação relevante"
      },
      "nivel_prioridade": "Alta | Média | Baixa",
      "observacoes_especificas": "string - Observações específicas desta frente"
    }
  ],
  "alertas_criticos": [
    {
      "tipo": "prazo_fatal | decisao_iminente | recurso_vencendo | execucao_critica",
      "frente": "string",
      "descricao": "string",
      "data_limite": "string | null",
      "nivel": "Crítico | Alto | Médio"
    }
  ],
  "calendario_proximas_acoes": [
    {
      "data_estimada": "string",
      "acao": "string",
      "frente": "string",
      "responsavel": "string",
      "prioridade": "Alta | Média | Baixa"
    }
  ],
  "analise_consolidada": {
    "total_frentes_ativas": number,
    "frentes_criticas": number,
    "prazos_proximos_30_dias": number,
    "recomendacao_prioritaria": "string"
  }
}

CRITÉRIOS DE PRIORIZAÇÃO:
- Alta: Prazos fatais correndo, decisões iminentes, recursos com prazo vencendo
- Média: Andamentos em curso sem urgência imediata
- Baixa: Questões pendentes sem prazo definido ou longo prazo

IMPORTANTE:
- Se não encontrar informação específica, use null
- Seja preciso nas datas e prazos
- Identifique TODAS as frentes, mesmo as menos evidentes
- Organize cronologicamente quando relevante`;
  }

  /**
   * PROMPT MAESTRO 2: Análise Multi-Frentes de Múltiplos Processos
   *
   * Para relatórios executivos de carteira de processos
   */
  static getAnaliseMultiFrentesMultiplos(
    processos: string[],
    tipoRelatorio: 'COMPLETO' | 'NOVIDADES' = 'COMPLETO',
    audiencia: 'Cliente' | 'Diretoria' | 'Uso Interno' = 'Cliente'
  ): string {

    const audienceInstructions = this.getAudienceInstructions(audiencia);
    const reportTypeInstructions = this.getReportTypeInstructions(tipoRelatorio);

    return `Você é um analista jurídico sênior especializado em relatórios executivos multi-processos organizados por frentes de discussão.

=== ANÁLISE MULTI-FRENTES - MÚLTIPLOS PROCESSOS ===

PROCESSOS: ${processos.join(', ')}

OBJETIVO:
Gerar relatório executivo consolidado organizando múltiplos processos por frentes de discussão, adaptado para ${audiencia.toLowerCase()}.

${audienceInstructions}

${reportTypeInstructions}

INSTRUÇÕES ESPECÍFICAS:
1. Para cada processo, identifique as frentes ativas
2. Agrupe processos por tipo de frente (execução, recursos, medidas cautelares, etc.)
3. Organize por prioridade e urgência
4. Apresente visão consolidada por tema/frente

ESTRUTURA OBRIGATÓRIA DO RELATÓRIO - RETORNE EM FORMATO JSON:

{
  "resumo_executivo": "Panorama geral da carteira de processos e principais destaques",
  "frentes_consolidadas": [
    {
      "nome_frente": "string - Ex: Execuções em Andamento, Recursos Pendentes",
      "processos_envolvidos": ["string - números dos processos"],
      "situacao_geral": "string - Status consolidado desta frente",
      "pontos_atencao": ["string - Pontos que merecem atenção"],
      "proximas_acoes": ["string - Ações necessárias"],
      "prazos_criticos": [
        {
          "processo": "string",
          "acao": "string",
          "prazo": "string",
          "responsavel": "string"
        }
      ],
      "indicadores": {
        "total_processos": number,
        "valores_envolvidos": number,
        "percentual_sucesso": number
      }
    }
  ],
  "calendario_acoes_prioritarias": [
    {
      "data_limite": "string",
      "acao": "string",
      "processo": "string",
      "frente": "string",
      "prioridade": "Alta | Média | Baixa",
      "responsavel": "string"
    }
  ],
  "indicadores_consolidados": {
    "total_processos": number,
    "total_frentes_ativas": number,
    "processos_por_frente": {},
    "valores_totais_por_frente": {},
    "alertas_urgencia": number,
    "prazos_proximos_30_dias": number
  },
  "alertas_estrategicos": [
    {
      "tipo": "string",
      "frente": "string",
      "processos_afetados": ["string"],
      "impacto": "Alto | Médio | Baixo",
      "recomendacao": "string"
    }
  ],
  "recomendacoes_executivas": ["string"],
  "observacoes_periodo": "string"
}`;
  }

  /**
   * PROMPT MAESTRO 3: Análise de Situação Específica
   *
   * Para análises pontuais de situações que impactam múltiplas frentes
   */
  static getAnaliseSituacaoEspecifica(
    numeroProcesso: string,
    situacao: string,
    contexto?: string
  ): string {
    return `Você é um consultor jurídico especializado em análise de situações processuais complexas e seus impactos em múltiplas frentes.

=== ANÁLISE DE SITUAÇÃO ESPECÍFICA ===

PROCESSO: ${numeroProcesso}
SITUAÇÃO: ${situacao}
${contexto ? `CONTEXTO ADICIONAL: ${contexto}` : ''}

OBJETIVO:
Analisar a situação específica descrita e determinar seus impactos em todas as frentes de discussão do processo, tanto diretos quanto indiretos.

INSTRUÇÕES ESPECÍFICAS:
1. Identifique a natureza jurídica da situação
2. Determine a frente principal diretamente afetada
3. Mapeie impactos em frentes secundárias
4. Avalie riscos e oportunidades gerados
5. Proponha estratégias de ação

ESTRUTURA DA RESPOSTA - RETORNE EM FORMATO JSON:

{
  "situacao_analisada": "${situacao}",
  "classificacao_juridica": "string - Natureza jurídica da situação",
  "frente_principal_afetada": "string",
  "analise_impacto_principal": {
    "status_anterior": "string",
    "status_atual": "string",
    "mudancas_significativas": ["string"],
    "implicacoes_juridicas": "string"
  },
  "frentes_secundarias_impactadas": [
    {
      "frente": "string",
      "tipo_impacto": "Positivo | Negativo | Neutro | Incerto",
      "nivel_impacto": "Alto | Médio | Baixo",
      "descricao_impacto": "string",
      "acoes_necessarias": ["string"]
    }
  ],
  "analise_riscos_oportunidades": {
    "riscos_identificados": [
      {
        "risco": "string",
        "probabilidade": "Alta | Média | Baixa",
        "impacto": "Alto | Médio | Baixo",
        "mitigacao": "string"
      }
    ],
    "oportunidades_identificadas": [
      {
        "oportunidade": "string",
        "viabilidade": "Alta | Média | Baixa",
        "beneficio": "Alto | Médio | Baixo",
        "aproveitamento": "string"
      }
    ]
  },
  "proximos_passos_recomendados": [
    {
      "acao": "string",
      "prazo": "string",
      "responsavel": "string",
      "prioridade": "Alta | Média | Baixa",
      "justificativa": "string"
    }
  ],
  "monitoramento_necessario": [
    {
      "aspecto": "string",
      "frequencia": "string",
      "indicadores": ["string"]
    }
  ]
}`;
  }

  /**
   * PROMPT MAESTRO 4: Prompt para Novidades/Delta
   *
   * Focado apenas nas mudanças desde o último período
   */
  static getAnaliseNovidades(
    processos: string[],
    periodoAnterior: string,
    ultimoRelatorio?: string
  ): string {
    return `Você é um analista jurídico especializado em identificar e organizar novidades e mudanças em processos judiciais.

=== ANÁLISE DE NOVIDADES E MUDANÇAS ===

PROCESSOS: ${processos.join(', ')}
PERÍODO ANTERIOR: ${periodoAnterior}
${ultimoRelatorio ? `ÚLTIMO RELATÓRIO COMO REFERÊNCIA: ${ultimoRelatorio}` : ''}

OBJETIVO:
Identificar e organizar APENAS as novidades, mudanças e movimentações ocorridas desde o último período de análise, organizadas por frentes de discussão.

INSTRUÇÕES ESPECÍFICAS:
1. Foque EXCLUSIVAMENTE no que mudou desde o período anterior
2. Organize as mudanças por frente de discussão afetada
3. Identifique se mudanças em uma frente impactaram outras
4. Destaque alterações de status, prazos novos ou vencidos
5. Se não houve movimentação em uma frente, mencione brevemente

ESTRUTURA DA RESPOSTA - RETORNE EM FORMATO JSON:

{
  "periodo_analise": "${periodoAnterior}",
  "resumo_novidades": "Resumo executivo das principais mudanças do período",
  "movimentacoes_por_frente": [
    {
      "frente": "string",
      "houve_movimentacao": boolean,
      "novidades": [
        {
          "data": "string",
          "tipo_movimento": "string",
          "descricao": "string",
          "impacto_status": "string - Como mudou o status da frente",
          "processos_afetados": ["string"]
        }
      ],
      "mudancas_prazos": [
        {
          "tipo": "novo_prazo | prazo_vencido | prorrogacao",
          "descricao": "string",
          "data_limite": "string",
          "responsavel": "string"
        }
      ],
      "status_anterior": "string",
      "status_atual": "string"
    }
  ],
  "novos_alertas": [
    {
      "tipo": "string",
      "processo": "string",
      "frente": "string",
      "descricao": "string",
      "urgencia": "Alta | Média | Baixa"
    }
  ],
  "prazos_surgidos": [
    {
      "processo": "string",
      "frente": "string",
      "acao": "string",
      "prazo": "string",
      "responsavel": "string"
    }
  ],
  "prazos_vencidos": [
    {
      "processo": "string",
      "frente": "string",
      "acao": "string",
      "data_vencimento": "string",
      "consequencias": "string"
    }
  ],
  "impactos_cruzados": [
    {
      "movimento_origem": "string",
      "frente_origem": "string",
      "frentes_impactadas": ["string"],
      "tipo_impacto": "string"
    }
  ],
  "recomendacoes_periodo": ["string"],
  "proximas_movimentacoes_esperadas": [
    {
      "previsao": "string",
      "processo": "string",
      "frente": "string",
      "prazo_estimado": "string"
    }
  ]
}`;
  }

  /**
   * Instruções específicas por público-alvo
   */
  private static getAudienceInstructions(audience: 'Cliente' | 'Diretoria' | 'Uso Interno'): string {
    switch (audience) {
      case 'Cliente':
        return `PÚBLICO-ALVO: CLIENTE
LINGUAGEM: Acessível e didática, evitando excesso de jargão jurídico
FOCO: Impactos práticos, próximos passos, custos e benefícios
DETALHAMENTO: Médio, explicando conceitos quando necessário
TERMINOLOGIA: Use termos como "processo", "recurso", "decisão judicial" em linguagem clara`;

      case 'Diretoria':
        return `PÚBLICO-ALVO: DIRETORIA EXECUTIVA
LINGUAGEM: Corporativa e objetiva, focada em resultados
FOCO: KPIs, riscos empresariais, impactos financeiros, decisões estratégicas
DETALHAMENTO: Alto nível, priorizando métricas e indicadores
TERMINOLOGIA: Use linguagem executiva, comparando com indicadores de performance`;

      case 'Uso Interno':
        return `PÚBLICO-ALVO: EQUIPE JURÍDICA INTERNA
LINGUAGEM: Técnica e precisa, pode usar jargão jurídico específico
FOCO: Aspectos técnicos, fundamentação legal, estratégias processuais
DETALHAMENTO: Completo, incluindo nuances e aspectos técnicos
TERMINOLOGIA: Use terminologia jurídica técnica sem simplificações`;

      default:
        return 'PÚBLICO-ALVO: GENÉRICO\nLINGUAGEM: Equilibrada entre técnica e acessível';
    }
  }

  /**
   * Instruções específicas por tipo de relatório
   */
  private static getReportTypeInstructions(reportType: 'COMPLETO' | 'NOVIDADES'): string {
    switch (reportType) {
      case 'COMPLETO':
        return `TIPO DE RELATÓRIO: ANÁLISE COMPLETA
ESCOPO: Análise abrangente de todos os aspectos dos processos
CONTEÚDO: Status geral, histórico relevante, análise de risco, projeções
ESTRUTURA: Visão 360° de cada frente de discussão
PROFUNDIDADE: Máxima, incluindo contexto histórico e projeções futuras`;

      case 'NOVIDADES':
        return `TIPO DE RELATÓRIO: DELTA/NOVIDADES
ESCOPO: Foque APENAS nas mudanças desde o último relatório
CONTEÚDO: Novas movimentações, alterações de status, prazos que surgiram/venceram
ESTRUTURA: Organize por "o que mudou" em cada frente
PROFUNDIDADE: Focada no delta, comparando com situação anterior
INSTRUÇÃO ESPECIAL: Se não houve movimentação significativa em uma frente, mencione brevemente e passe para a próxima`;

      default:
        return 'TIPO: Relatório padrão com análise equilibrada';
    }
  }

  /**
   * Prompt para análise de precedentes e jurisprudência aplicável
   */
  static getAnaliseJurisprudencial(
    numeroProcesso: string,
    questaoJuridica: string,
    instancia: string = 'todas'
  ): string {
    return `Você é um especialista em jurisprudência e precedentes dos tribunais superiores brasileiros.

=== ANÁLISE JURISPRUDENCIAL ESTRATÉGICA ===

PROCESSO: ${numeroProcesso}
QUESTÃO JURÍDICA: ${questaoJuridica}
INSTÂNCIA DE INTERESSE: ${instancia}

OBJETIVO:
Identificar precedentes relevantes, súmulas, teses firmadas e jurisprudência aplicável à questão jurídica específica, organizando por impacto nas diferentes frentes de discussão.

INSTRUÇÕES ESPECÍFICAS:
1. Busque precedentes vinculantes dos tribunais superiores
2. Identifique súmulas aplicáveis
3. Analise tendência jurisprudencial dominante
4. Organize por impacto em cada frente de discussão

ESTRUTURA DA RESPOSTA - RETORNE EM FORMATO JSON:

{
  "questao_analisada": "${questaoJuridica}",
  "precedentes_vinculantes": [
    {
      "tribunal": "STF | STJ | TST | etc",
      "numero_processo": "string",
      "tese_firmada": "string",
      "aplicabilidade": "Direta | Indireta | Analogica",
      "frentes_impactadas": ["string"],
      "favorabilidade": "Favorável | Desfavorável | Neutra"
    }
  ],
  "sumulas_aplicaveis": [
    {
      "tribunal": "string",
      "numero": "string",
      "enunciado": "string",
      "vinculante": boolean,
      "impacto_estrategico": "string"
    }
  ],
  "jurisprudencia_dominante": {
    "tendencia_geral": "string",
    "percentual_sucesso": "string",
    "argumentos_recorrentes": ["string"]
  },
  "estrategia_jurisprudencial": [
    {
      "frente": "string",
      "precedente_principal": "string",
      "argumentacao_sugerida": "string",
      "riscos": ["string"]
    }
  ]
}`;
  }

  /**
   * Utilitário para validar se um prompt está estruturado corretamente
   */
  static validatePromptStructure(prompt: string): {
    isValid: boolean;
    errors: string[];
    suggestions: string[];
  } {
    const errors: string[] = [];
    const suggestions: string[] = [];

    // Verificações básicas
    if (!prompt.includes('OBJETIVO')) {
      errors.push('Prompt deve incluir seção OBJETIVO clara');
    }

    if (!prompt.includes('ESTRUTURA') && !prompt.includes('JSON')) {
      errors.push('Prompt deve especificar estrutura de resposta esperada');
    }

    if (!prompt.includes('frente')) {
      suggestions.push('Considere incluir análise por frentes para processos complexos');
    }

    return {
      isValid: errors.length === 0,
      errors,
      suggestions
    };
  }
}

// Exportar tipos e classe
export default PromptsMaestros;
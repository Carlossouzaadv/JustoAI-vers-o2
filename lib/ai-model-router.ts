// ================================================================
// AI MODEL ROUTER - Adaptado do model_router.py do JustoAI V1
// ================================================================
// Implementa roteamento inteligente de modelos baseado em complexidade para economia de custos

export enum ModelTier {
  LITE = 'gemini-1.5-flash-8b',   // Mais barato (95% economia)
  BALANCED = 'gemini-1.5-flash',  // Equilibrado
  PRO = 'gemini-1.5-pro'          // Maior qualidade
}

export interface ComplexityScore {
  totalScore: number;
  factors: {
    documentType: number; // NOVO: Pontuação baseada no tipo de documento
    textLength: number;
    legalComplexity: number;
    structuralComplexity: number;
    filesizeComplexity: number;
  };
  recommendedTier: ModelTier;
  confidence: number;
  documentType?: string; // NOVO: Tipo de documento detectado
}

export interface ProcessingConfig {
  model: ModelTier;
  maxTokens: number;
  temperature: number;
  promptTemplate: string;
  fallbackModel?: ModelTier;
}

export interface ModelCosts {
  inputTokenCost: number;   // Custo por 1K tokens de entrada
  outputTokenCost: number;  // Custo por 1K tokens de saída
  estimatedCost: number;    // Custo estimado total
}

/**
 * SCHEMA BASE UNIFICADO - Baseado em report_generator.py V1
 * Este schema serve como guia para todos os modelos Gemini
 */
export interface UnifiedProcessSchema {
  // ========== SEÇÃO A: IDENTIFICAÇÃO BÁSICA ==========
  identificacao_basica: {
    numero_processo: string | null;
    tipo_processual: string | null;
    esfera: "Federal" | "Estadual" | "Municipal" | "Trabalhista" | null;
    orgao_instancia: string | null;
    comarca: string | null;
    vara: string | null;
    juiz_responsavel: string | null;
  };

  // ========== SEÇÃO B: PARTES ENVOLVIDAS ==========
  partes_envolvidas: {
    parte_principal: {
      nome: string | null;
      cpf_cnpj: string | null;
      tipo: "Física" | "Jurídica" | null;
      qualificacao: string | null; // Ex: Exequente, Autor, Reclamante
    };
    parte_contraria: {
      nome: string | null;
      cpf_cnpj: string | null;
      tipo: "Física" | "Jurídica" | null;
      qualificacao: string | null; // Ex: Executado, Réu, Reclamado
    };
    outras_partes: Array<{
      nome: string;
      cpf_cnpj: string | null;
      qualificacao: string;
    }> | null;
  };

  // ========== SEÇÃO C: VALORES E FINANCEIRO ==========
  valores_financeiros: {
    valor_principal: number | null;
    multas: number | null;
    juros: number | null;
    encargos_legais: number | null;
    valor_total: number | null;
    valor_atualizado_em: string | null; // Data
    observacoes_valores: string | null;
  };

  // ========== SEÇÃO D: CAMPOS ESPECIALIZADOS POR TIPO ==========
  campos_especializados: {
    // Execução Fiscal
    execucao_fiscal?: {
      cdas_numeros: string[] | null;
      valor_originario: number | null;
      multas_fiscais: number | null;
      inscricao_divida_ativa: string | null;
    };
    // Ação Civil
    acao_civil?: {
      pedido_principal: string | null;
      causa_pedir: string | null;
      valor_causa: number | null;
    };
    // Trabalhista
    trabalhista?: {
      ctps: string | null;
      salario_base: number | null;
      periodo_trabalho: string | null;
      verbas_rescisórias: number | null;
    };
    // Previdenciário
    previdenciario?: {
      beneficio_requerido: string | null;
      dib: string | null; // Data Início Benefício
      rmi: number | null; // Renda Mensal Inicial
      auxilio_doenca: boolean | null;
    };
    // Família
    familia?: {
      regime_bens: string | null;
      guarda_filhos: string | null;
      pensao_alimenticia: number | null;
    };
    // Consumidor
    consumidor?: {
      relacao_consumo: string | null;
      defeito_vicio: string | null;
      dano_moral_material: string | null;
    };
    // Penal
    penal?: {
      tipo_penal: string | null;
      pena_aplicada: string | null;
      regime_cumprimento: string | null;
    };
    // Empresarial
    empresarial?: {
      cnpj: string | null;
      atividade_empresarial: string | null;
      dissolucao_sociedade: boolean | null;
    };
  };

  // ========== SEÇÃO E: SITUAÇÃO E ANDAMENTOS ==========
  situacao_processual: {
    situacao_atual: string | null;
    fase_processual: string | null;
    ultimo_andamento: {
      data: string | null;
      tipo: string | null;
      resumo: string | null;
    } | null;
    principais_andamentos: Array<{
      data: string;
      tipo: string;
      resumo: string;
    }> | null;
    prazos_pendentes: Array<{
      descricao: string;
      data_limite: string;
      responsavel: string;
    }> | null;
  };

  // ========== SEÇÃO F: ANÁLISE DE RISCO E ESTRATÉGIA ==========
  analise_estrategica: {
    tese_juridica_central: string | null;
    risco_classificacao: "Provável" | "Possível" | "Remoto" | null;
    risco_justificativa: string | null;
    oportunidades_processuais: string[] | null;
    recomendacoes_estrategicas: string[] | null;
    pontos_atencao: string[] | null;
    precedentes_relevantes: string[] | null;
  };

  // ========== SEÇÃO G: DOCUMENTOS E ANEXOS ==========
  documentos_relacionados: {
    documentos_anexos: Array<{
      nome: string;
      tipo: string;
      data_juntada: string;
    }> | null;
    certidoes_pendentes: string[] | null;
    documentos_solicitados: string[] | null;
  };

  // ========== SEÇÃO H: METADADOS DA ANÁLISE ==========
  metadados_analise: {
    data_analise: string;
    modelo_utilizado: string;
    confianca_geral: number; // 0-1
    observacoes_ia: string | null;
    campos_nao_encontrados: string[] | null;
  };
}

export class AIModelRouter {
  private readonly MODEL_COSTS: Record<ModelTier, { input: number; output: number }> = {
    [ModelTier.LITE]: { input: 0.0375, output: 0.15 },      // Gemini 1.5 Flash 8B (mais barato) - preços por 1M tokens
    [ModelTier.BALANCED]: { input: 0.075, output: 0.30 },   // Gemini 1.5 Flash
    [ModelTier.PRO]: { input: 1.25, output: 5.00 }          // Gemini 1.5 Pro (mais caro)
  };

  /**
   * Analisa complexidade do texto e recomenda modelo otimizado
   * Baseado no complexity_analyzer.py do V1 + NOVA Classificação por tipo de documento
   *
   * REGRAS ESPECÍFICAS POR TIPO:
   * 📍 ANÁLISE RÁPIDA (Flash 8B): Juntadas, despachos de expediente, movimentações
   * 📍 ANÁLISE PADRÃO (Flash): Petições, contestações, recursos comuns
   * 📍 ANÁLISE COMPLETA (Pro): Sentenças, acórdãos, decisões superiores
   */
  analyzeComplexity(text: string, fileSizeMB: number = 0): ComplexityScore {
    console.log('🧮 Analisando complexidade do documento...');

    // 1. DETECTAR TIPO DE DOCUMENTO
    const documentType = this.detectDocumentType(text);
    console.log(`📄 Tipo detectado: ${documentType.type} (confiança: ${Math.round(documentType.confidence * 100)}%)`);

    // 2. APLICAR REGRAS ESPECÍFICAS POR TIPO
    const documentTypeScore = this.getDocumentTypeComplexityScore(documentType);

    // 3. CALCULAR FATORES TRADICIONAIS
    const factors = {
      documentType: documentTypeScore,
      textLength: this.calculateTextLengthScore(text),
      legalComplexity: this.calculateLegalComplexityScore(text),
      structuralComplexity: this.calculateStructuralComplexityScore(text),
      filesizeComplexity: this.calculateFilesizeScore(fileSizeMB)
    };

    const totalScore = Object.values(factors).reduce((sum, score) => sum + score, 0);

    // 4. LÓGICA DE ROTEAMENTO ATUALIZADA
    // ANÁLISE RÁPIDA (Flash 8B): 0-35 pontos
    // ANÁLISE PADRÃO (Flash): 36-75 pontos
    // ANÁLISE COMPLETA (Pro): >75 pontos

    let recommendedTier: ModelTier;
    let confidence: number;

    if (totalScore <= 35) {
      recommendedTier = ModelTier.LITE; // Flash 8B - Análise Rápida
      confidence = 0.9;
    } else if (totalScore <= 75) {
      recommendedTier = ModelTier.BALANCED; // Flash - Análise Padrão
      confidence = 0.85;
    } else {
      recommendedTier = ModelTier.PRO; // Pro - Análise Completa
      confidence = 0.95;
    }

    console.log(`📊 Complexidade: ${totalScore} pontos (${documentType.type}) → Modelo: ${recommendedTier}`);

    return {
      totalScore,
      factors,
      recommendedTier,
      confidence,
      documentType: documentType.type
    };
  }

  /**
   * NOVA FUNCIONALIDADE: Detecta tipo de documento jurídico
   * Baseado em padrões específicos e palavras-chave
   */
  private detectDocumentType(text: string): { type: string; confidence: number } {
    const lowerText = text.toLowerCase();
    const firstLines = text.split('\n').slice(0, 10).join('\n').toLowerCase();

    // ANÁLISE RÁPIDA (Flash 8B) - Documentos de baixa complexidade
    const rapidAnalysisPatterns = [
      { pattern: /juntada|juntou-se|juntei|anexo|documento anexo/i, type: 'JUNTADA', weight: 3 },
      { pattern: /despacho.*mero expediente|certidão|intimação|publicação/i, type: 'DESPACHO_EXPEDIENTE', weight: 3 },
      { pattern: /carga dos autos|conclusão|vista|remessa/i, type: 'MOVIMENTACAO_CARTORIO', weight: 2 },
      { pattern: /ar.*juntado|comprovante.*entrega|aviso.*recebimento/i, type: 'COMPROVANTE_INTIMACAO', weight: 2 }
    ];

    // ANÁLISE PADRÃO (Flash) - Documentos do dia a dia
    const standardAnalysisPatterns = [
      { pattern: /petição inicial|exordial|inicial/i, type: 'PETICAO_INICIAL', weight: 4 },
      { pattern: /contestação|resposta|defesa/i, type: 'CONTESTACAO', weight: 4 },
      { pattern: /tréplica|impugnação.*contestação/i, type: 'TREPLICA', weight: 3 },
      { pattern: /agravo.*instrumento|agravo.*retido/i, type: 'AGRAVO', weight: 3 },
      { pattern: /apelação|recurso.*apelação/i, type: 'APELACAO', weight: 3 },
      { pattern: /embargos.*declaração|embargos declaratórios/i, type: 'EMBARGOS_DECLARACAO', weight: 2 },
      { pattern: /mandado.*segurança|impetrante|impetrado/i, type: 'MANDADO_SEGURANCA', weight: 3 },
      { pattern: /ação.*civil.*pública|ministério.*público.*autor/i, type: 'ACAO_CIVIL_PUBLICA', weight: 4 }
    ];

    // ANÁLISE COMPLETA (Pro) - Documentos de alta complexidade
    const complexAnalysisPatterns = [
      { pattern: /sentença|julgo.*procedente|julgo.*improcedente|dispositivo/i, type: 'SENTENCA', weight: 8 },
      { pattern: /acórdão|acordam.*desembargadores|tribunal.*justiça.*decide/i, type: 'ACORDAO', weight: 8 },
      { pattern: /supremo.*tribunal|stf|recurso.*extraordinário/i, type: 'DECISAO_STF', weight: 10 },
      { pattern: /superior.*tribunal.*justiça|stj|recurso.*especial/i, type: 'DECISAO_STJ', weight: 8 },
      { pattern: /constitucional.*inconstitucionalidade|controle.*constitucionalidade/i, type: 'CONTROLE_CONSTITUCIONALIDADE', weight: 10 },
      { pattern: /precedente.*vinculante|súmula.*vinculante|repercussão.*geral/i, type: 'PRECEDENTE_VINCULANTE', weight: 9 }
    ];

    // Calcular pontuações para cada categoria
    const scores = {
      rapid: this.calculatePatternScore(lowerText, rapidAnalysisPatterns),
      standard: this.calculatePatternScore(lowerText, standardAnalysisPatterns),
      complex: this.calculatePatternScore(lowerText, complexAnalysisPatterns)
    };

    // Determinar tipo e confiança
    const maxScore = Math.max(...Object.values(scores));
    const maxCategory = Object.keys(scores).find(key => scores[key as keyof typeof scores] === maxScore);

    if (maxScore === 0) {
      return { type: 'DOCUMENTO_GENERICO', confidence: 0.5 };
    }

    // Encontrar padrão específico com maior pontuação
    const allPatterns = [...rapidAnalysisPatterns, ...standardAnalysisPatterns, ...complexAnalysisPatterns];
    let bestMatch = { type: 'DOCUMENTO_GENERICO', score: 0 };

    for (const pattern of allPatterns) {
      if (pattern.pattern.test(lowerText)) {
        if (pattern.weight > bestMatch.score) {
          bestMatch = { type: pattern.type, score: pattern.weight };
        }
      }
    }

    const confidence = Math.min(bestMatch.score / 10, 1); // Normalizar para 0-1

    return {
      type: bestMatch.type,
      confidence
    };
  }

  /**
   * Calcula pontuação para padrões específicos
   */
  private calculatePatternScore(text: string, patterns: Array<{ pattern: RegExp; type: string; weight: number }>): number {
    let score = 0;
    for (const pattern of patterns) {
      if (pattern.pattern.test(text)) {
        score += pattern.weight;
      }
    }
    return score;
  }

  /**
   * NOVA FUNCIONALIDADE: Aplica pontuação baseada no tipo de documento
   * Implementa as regras específicas solicitadas
   */
  private getDocumentTypeComplexityScore(documentType: { type: string; confidence: number }): number {
    const { type, confidence } = documentType;

    // ANÁLISE RÁPIDA (Flash 8B) - 0-10 pontos
    const rapidAnalysisTypes = {
      'JUNTADA': 2,
      'DESPACHO_EXPEDIENTE': 3,
      'MOVIMENTACAO_CARTORIO': 1,
      'COMPROVANTE_INTIMACAO': 1
    };

    // ANÁLISE PADRÃO (Flash) - 10-25 pontos
    const standardAnalysisTypes = {
      'PETICAO_INICIAL': 15,
      'CONTESTACAO': 18,
      'TREPLICA': 12,
      'AGRAVO': 20,
      'APELACAO': 22,
      'EMBARGOS_DECLARACAO': 10,
      'MANDADO_SEGURANCA': 15,
      'ACAO_CIVIL_PUBLICA': 25
    };

    // ANÁLISE COMPLETA (Pro) - 30-50 pontos
    const complexAnalysisTypes = {
      'SENTENCA': 35,
      'ACORDAO': 40,
      'DECISAO_STF': 50,
      'DECISAO_STJ': 45,
      'CONTROLE_CONSTITUCIONALIDADE': 50,
      'PRECEDENTE_VINCULANTE': 48
    };

    // Buscar pontuação base
    let baseScore = 5; // Padrão para documentos não classificados

    if (type in rapidAnalysisTypes) {
      baseScore = rapidAnalysisTypes[type as keyof typeof rapidAnalysisTypes];
    } else if (type in standardAnalysisTypes) {
      baseScore = standardAnalysisTypes[type as keyof typeof standardAnalysisTypes];
    } else if (type in complexAnalysisTypes) {
      baseScore = complexAnalysisTypes[type as keyof typeof complexAnalysisTypes];
    }

    // Aplicar confiança (reduzir pontuação se detecção incerta)
    const finalScore = Math.round(baseScore * confidence);

    console.log(`📄 Tipo: ${type} → Base: ${baseScore}, Confiança: ${Math.round(confidence * 100)}%, Final: ${finalScore}`);

    return finalScore;
  }

  /**
   * Calcula pontuação baseada no tamanho do texto - ajustado para documentos grandes
   */
  private calculateTextLengthScore(text: string): number {
    const length = text.length;

    if (length < 10000) return 3;       // Textos curtos
    if (length < 50000) return 8;       // Textos médios
    if (length < 150000) return 15;     // Textos longos (padrão 300-400 páginas)
    if (length < 300000) return 25;     // Textos muito longos
    return 35;                          // Textos extremamente longos
  }

  /**
   * Calcula complexidade jurídica baseada em palavras-chave
   */
  private calculateLegalComplexityScore(text: string): number {
    const lowerText = text.toLowerCase();
    let score = 0;

    // Termos que indicam alta complexidade jurídica
    const highComplexityTerms = [
      'constitucional', 'inconstitucionalidade', 'supremo tribunal',
      'recurso extraordinário', 'repercussão geral', 'precedente vinculante',
      'modulação de efeitos', 'coisa julgada', 'devido processo legal'
    ];

    // Termos que indicam complexidade média
    const mediumComplexityTerms = [
      'apelação', 'agravo', 'embargos', 'mandado de segurança',
      'ação civil pública', 'execução fiscal', 'usucapião'
    ];

    // Contar termos de alta complexidade
    for (const term of highComplexityTerms) {
      const matches = (lowerText.match(new RegExp(term, 'g')) || []).length;
      score += matches * 3; // Peso alto
    }

    // Contar termos de complexidade média
    for (const term of mediumComplexityTerms) {
      const matches = (lowerText.match(new RegExp(term, 'g')) || []).length;
      score += matches * 1.5; // Peso médio
    }

    // Detectar citações legais frequentes (indica complexidade)
    const legalCitations = (lowerText.match(/(?:art\.|artigo)\s*\d+/g) || []).length;
    score += Math.min(legalCitations * 0.5, 10); // Máximo 10 pontos por citações

    return Math.min(score, 25); // Máximo 25 pontos para este fator
  }

  /**
   * Calcula complexidade estrutural do documento
   */
  private calculateStructuralComplexityScore(text: string): number {
    let score = 0;

    // Contar diferentes tipos de estruturas
    const structures = {
      lists: (text.match(/^\s*[\d\w]\.\s/gm) || []).length,
      tables: (text.match(/\|[\s\S]*?\|/g) || []).length,
      sections: (text.match(/^\s*[IVX]+\.\s/gm) || []).length,
      subsections: (text.match(/^\s*\d+\.\d+\s/gm) || []).length
    };

    // Pontuação baseada na complexidade estrutural
    score += Math.min(structures.lists * 0.5, 5);
    score += Math.min(structures.tables * 2, 8);
    score += Math.min(structures.sections * 1, 5);
    score += Math.min(structures.subsections * 0.5, 3);

    return Math.min(score, 20); // Máximo 20 pontos
  }

  /**
   * Calcula complexidade baseada no tamanho do arquivo - ajustado para média de 50MB
   */
  private calculateFilesizeScore(fileSizeMB: number): number {
    if (fileSizeMB < 10) return 0;      // Arquivos pequenos
    if (fileSizeMB < 30) return 5;      // Arquivos médios
    if (fileSizeMB < 60) return 10;     // Arquivos padrão (50MB média)
    if (fileSizeMB < 100) return 20;    // Arquivos grandes
    return 30;                          // Arquivos muito grandes
  }

  /**
   * Gera configuração otimizada para processamento
   */
  getProcessingConfig(complexity: ComplexityScore, documentType: string = 'legal'): ProcessingConfig {
    const model = complexity.recommendedTier;

    const configs: Record<ModelTier, ProcessingConfig> = {
      [ModelTier.LITE]: {
        model: ModelTier.LITE,
        maxTokens: 2000,
        temperature: 0.1,
        promptTemplate: this.getOptimizedPrompt(ModelTier.LITE, documentType),
        fallbackModel: ModelTier.BALANCED
      },
      [ModelTier.BALANCED]: {
        model: ModelTier.BALANCED,
        maxTokens: 3000,
        temperature: 0.2,
        promptTemplate: this.getOptimizedPrompt(ModelTier.BALANCED, documentType),
        fallbackModel: ModelTier.PRO
      },
      [ModelTier.PRO]: {
        model: ModelTier.PRO,
        maxTokens: 4000,
        temperature: 0.1,
        promptTemplate: this.getOptimizedPrompt(ModelTier.PRO, documentType)
      }
    };

    return configs[model];
  }

  /**
   * Gera prompts otimizados por modelo usando Schema Base Unificado
   */
  private getOptimizedPrompt(tier: ModelTier, documentType: string): string {
    const schemaJson = this.getUnifiedSchemaForPrompt();

    switch (tier) {
      case ModelTier.LITE:
        return `Você é um assistente jurídico de IA focado em extração de dados essenciais. Analise o documento anexo.

INSTRUÇÕES:
1. Extraia apenas as informações mais críticas para uma rápida identificação.
2. Se uma informação não for encontrada, use o valor null.
3. Retorne a resposta em formato JSON, seguindo estritamente o schema fornecido.

FOCO DA EXTRAÇÃO:
Preencha APENAS as seções A (identificacao_basica), B (partes_envolvidas) e C (valores_financeiros) do schema. Ignore as outras seções complexas.

SCHEMA DE SAÍDA:
${schemaJson}`;

      case ModelTier.BALANCED:
        return `Você é um assistente jurídico especializado em análise completa de documentos legais. Analise o documento anexo.

INSTRUÇÕES:
1. Realize uma análise completa dos dados do processo.
2. Faça uma avaliação de risco preliminar baseada nos fatos apresentados.
3. Se uma informação não for encontrada, use o valor null.
4. Retorne a resposta em formato JSON, seguindo estritamente o schema fornecido.

FOCO DA EXTRAÇÃO:
Preencha as seções A, B, C, D (campos_especializados), E (situacao_processual) e F (analise_estrategica - risco_classificacao e risco_justificativa devem ser concisos, 1-2 frases). Ignore a seção G (documentos_relacionados).

SCHEMA DE SAÍDA:
${schemaJson}`;

      case ModelTier.PRO:
        return `Você é um analista jurídico sênior de IA, especializado em análises detalhadas e estratégicas de processos judiciais brasileiros. Analise o documento anexo.

INSTRUÇÕES AVANÇADAS:
1. Conduza uma análise jurídica abrangente e profunda.
2. Extraia todos os dados factuais com a máxima precisão.
3. Na seção "analise_estrategica", forneça insights qualitativos, identificando a tese central, oportunidades, riscos e recomendações práticas.
4. Se uma informação não for encontrada, use o valor null.
5. Retorne a resposta em formato JSON, seguindo estritamente o schema fornecido.

FOCO DA EXTRAÇÃO:
Preencha TODAS as seções do schema com o maior detalhamento possível. Use sua expertise para análises estratégicas fundamentadas.

SCHEMA DE SAÍDA:
${schemaJson}`;

      default:
        return "Você é um assistente jurídico especializado em análise de documentos.";
    }
  }

  /**
   * Retorna o schema unificado em formato JSON para os prompts
   */
  private getUnifiedSchemaForPrompt(): string {
    return JSON.stringify({
      identificacao_basica: {
        numero_processo: "string | null",
        tipo_processual: "string | null",
        esfera: "Federal | Estadual | Municipal | Trabalhista | null",
        orgao_instancia: "string | null",
        comarca: "string | null",
        vara: "string | null",
        juiz_responsavel: "string | null"
      },
      partes_envolvidas: {
        parte_principal: {
          nome: "string | null",
          cpf_cnpj: "string | null",
          tipo: "Física | Jurídica | null",
          qualificacao: "string | null"
        },
        parte_contraria: {
          nome: "string | null",
          cpf_cnpj: "string | null",
          tipo: "Física | Jurídica | null",
          qualificacao: "string | null"
        },
        outras_partes: "Array<{nome, cpf_cnpj, qualificacao}> | null"
      },
      valores_financeiros: {
        valor_principal: "number | null",
        multas: "number | null",
        juros: "number | null",
        encargos_legais: "number | null",
        valor_total: "number | null",
        valor_atualizado_em: "string | null",
        observacoes_valores: "string | null"
      },
      campos_especializados: "Objeto específico baseado no tipo de processo identificado",
      situacao_processual: {
        situacao_atual: "string | null",
        fase_processual: "string | null",
        ultimo_andamento: "objeto com data, tipo, resumo",
        principais_andamentos: "Array de objetos com data, tipo, resumo",
        prazos_pendentes: "Array de objetos | null"
      },
      analise_estrategica: {
        tese_juridica_central: "string | null",
        risco_classificacao: "Provável | Possível | Remoto | null",
        risco_justificativa: "string | null",
        oportunidades_processuais: "Array<string> | null",
        recomendacoes_estrategicas: "Array<string> | null",
        pontos_atencao: "Array<string> | null",
        precedentes_relevantes: "Array<string> | null"
      },
      documentos_relacionados: {
        documentos_anexos: "Array de objetos | null",
        certidoes_pendentes: "Array<string> | null",
        documentos_solicitados: "Array<string> | null"
      },
      metadados_analise: {
        data_analise: "string",
        modelo_utilizado: "string",
        confianca_geral: "number 0-1",
        observacoes_ia: "string | null",
        campos_nao_encontrados: "Array<string> | null"
      }
    }, null, 2);
  }

  /**
   * Calcula custo estimado do processamento
   */
  calculateCost(inputTokens: number, outputTokens: number, model: ModelTier): ModelCosts {
    const costs = this.MODEL_COSTS[model];

    const inputCost = (inputTokens / 1000) * costs.input;
    const outputCost = (outputTokens / 1000) * costs.output;
    const estimatedCost = inputCost + outputCost;

    return {
      inputTokenCost: inputCost,
      outputTokenCost: outputCost,
      estimatedCost: Math.round(estimatedCost * 10000) / 10000 // 4 casas decimais
    };
  }

  /**
   * Estimativa de tokens para um texto
   */
  estimateTokens(text: string): number {
    // Aproximação: 1 token ≈ 4 caracteres em português
    return Math.ceil(text.length / 4);
  }

  /**
   * Determina se deve fazer fallback para modelo mais potente
   */
  shouldFallback(result: any, originalComplexity: ComplexityScore): boolean {
    // Critérios para fallback baseados na qualidade do resultado
    if (!result || typeof result !== 'object') return true;

    // Se resultado está muito incompleto
    const extractedFields = Object.keys(result).length;
    if (extractedFields < 5 && originalComplexity.totalScore > 20) return true;

    // Se confiança do modelo original foi baixa
    if (originalComplexity.confidence < 0.7) return true;

    return false;
  }

  /**
   * Processa com fallback automático se necessário
   */
  async processWithFallback(
    text: string,
    complexity: ComplexityScore,
    processingFunction: (config: ProcessingConfig) => Promise<any>
  ): Promise<{ result: any; modelUsed: ModelTier; cost: ModelCosts }> {

    let config = this.getProcessingConfig(complexity);
    let result: any;
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      try {
        console.log(`🤖 Tentativa ${attempts + 1} com modelo ${config.model}`);

        result = await processingFunction(config);

        // Verificar se precisa fazer fallback
        if (this.shouldFallback(result, complexity) && config.fallbackModel && attempts === 0) {
          console.log(`⬆️ Fazendo fallback para ${config.fallbackModel}`);
          config.model = config.fallbackModel;
          config = this.getProcessingConfig({ ...complexity, recommendedTier: config.fallbackModel });
          attempts++;
          continue;
        }

        break;

      } catch (error) {
        console.error(`❌ Erro no modelo ${config.model}:`, error);

        if (config.fallbackModel && attempts === 0) {
          console.log(`⬆️ Fallback por erro para ${config.fallbackModel}`);
          config.model = config.fallbackModel;
          config = this.getProcessingConfig({ ...complexity, recommendedTier: config.fallbackModel });
          attempts++;
          continue;
        }

        throw error;
      }
    }

    // Calcular custo final
    const inputTokens = this.estimateTokens(text);
    const outputTokens = this.estimateTokens(JSON.stringify(result));
    const cost = this.calculateCost(inputTokens, outputTokens, config.model);

    console.log(`💰 Custo estimado: $${cost.estimatedCost} com modelo ${config.model}`);

    return {
      result,
      modelUsed: config.model,
      cost
    };
  }

  /**
   * Relatório de economia de custos
   */
  getCostSavingsReport(actualModel: ModelTier, originalComplexity: ComplexityScore, inputTokens: number): {
    actualCost: number;
    worstCaseCost: number;
    savings: number;
    savingsPercentage: number;
  } {
    const actualCost = this.calculateCost(inputTokens, inputTokens * 0.3, actualModel).estimatedCost;
    const worstCaseCost = this.calculateCost(inputTokens, inputTokens * 0.3, ModelTier.PRO).estimatedCost;

    const savings = worstCaseCost - actualCost;
    const savingsPercentage = Math.round((savings / worstCaseCost) * 100);

    return {
      actualCost,
      worstCaseCost,
      savings,
      savingsPercentage
    };
  }

  // ================================
  // MÉTODOS DE ANÁLISE DE ALTO NÍVEL
  // ================================

  /**
   * Análise ESSENCIAL - SEMPRE Gemini Flash 8B
   * Cache agressivo (7 dias) para máxima economia
   */
  async analyzeEssential(text: string, workspaceId?: string): Promise<any> {
    const { getAiCache, generateTextHash } = await import('./ai-cache-manager');
    const { ICONS } = await import('./icons');

    console.log(`${ICONS.PROCESS} Análise ESSENCIAL iniciada (Flash 8B)`);

    const cache = getAiCache();
    const textHash = generateTextHash(text);

    // 1. Buscar no cache primeiro (CRÍTICO para economia)
    const cached = await cache.getEssential(textHash);
    if (cached) {
      console.log(`${ICONS.CACHE} Cache HIT - Análise essencial: ${cached._routing_info?.tokens_saved || 0} tokens economizados`);
      return cached;
    }

    // 2. Processar com Flash 8B (mais barato) - usando LITE do ai-model-router
    const complexity = this.analyzeComplexity(text);
    const result = await this.processWithFallback(
      text,
      { ...complexity, recommendedTier: ModelTier.LITE },
      async (config) => {
        return await this.processWithModel(text, ModelTier.LITE, 'essential');
      }
    );

    // 3. Salvar no cache (CRÍTICO)
    await cache.setEssential(textHash, result.result, {
      tokens_saved: this.estimateTokens(text),
      workspaceId
    });

    console.log(`${ICONS.SUCCESS} Análise essencial concluída e cacheada`);
    return result.result;
  }

  /**
   * Análise ESTRATÉGICA - Router por complexidade
   * Cache por tier para otimização
   */
  async analyzeStrategic(text: string, fileSizeMb: number = 0, workspaceId?: string): Promise<any> {
    const { getAiCache, generateTextHash } = await import('./ai-cache-manager');
    const { ICONS } = await import('./icons');

    console.log(`${ICONS.PROCESS} Análise ESTRATÉGICA iniciada (routing por complexidade)`);

    const cache = getAiCache();
    const textHash = generateTextHash(text);
    const complexityScore = this.analyzeComplexity(text, fileSizeMb);

    // 1. Buscar no cache por tier
    const cached = await cache.getStrategic(textHash, complexityScore.totalScore);
    if (cached) {
      console.log(`${ICONS.CACHE} Cache HIT - Análise estratégica: ${cached._routing_info?.tokens_saved || 0} tokens economizados`);
      return cached;
    }

    // 2. Processar com tier recomendado
    const result = await this.processWithFallback(
      text,
      complexityScore,
      async (config) => {
        return await this.processWithModel(text, complexityScore.recommendedTier, 'strategic');
      }
    );

    result.result._routing_info = {
      ...result.result._routing_info,
      complexity_score: complexityScore.totalScore,
      complexity_factors: complexityScore.factors,
      reasoning: `Complexity: ${complexityScore.totalScore} points → Model: ${complexityScore.recommendedTier}`
    };

    // 3. Salvar no cache por tier
    await cache.setStrategic(textHash, result.result, complexityScore.totalScore, {
      model: complexityScore.recommendedTier,
      tokens_saved: this.estimateTokens(text),
      workspaceId
    });

    console.log(`${ICONS.SUCCESS} Análise estratégica concluída (${complexityScore.recommendedTier}) e cacheada`);
    return result.result;
  }

  /**
   * Relatórios - SEMPRE Gemini Flash
   * Cache específico para relatórios
   */
  async generateReport(
    reportData: any,
    reportType: string = 'general',
    workspaceId?: string
  ): Promise<any> {
    const { getAiCache, generateTextHash } = await import('./ai-cache-manager');
    const { ICONS } = await import('./icons');

    console.log(`${ICONS.PROCESS} Relatório iniciado (Flash)`);

    const cache = getAiCache();
    const reportHash = generateTextHash(JSON.stringify(reportData) + reportType);

    // 1. Buscar no cache
    const cached = await cache.getReport(reportHash);
    if (cached) {
      console.log(`${ICONS.CACHE} Cache HIT - Relatório: ${cached._routing_info?.tokens_saved || 0} tokens economizados`);
      return cached;
    }

    // 2. Processar com Flash (bom custo-benefício para relatórios) - usando BALANCED
    const result = await this.processWithFallback(
      JSON.stringify(reportData),
      {
        totalScore: 0,
        factors: {
          textLength: 0,
          legalComplexity: 0,
          structuralComplexity: 0,
          filesizeComplexity: 0
        },
        recommendedTier: ModelTier.BALANCED,
        confidence: 0.9
      },
      async (config) => {
        return await this.processWithModel(JSON.stringify(reportData), ModelTier.BALANCED, 'report');
      }
    );

    // 3. Salvar no cache
    await cache.setReport(reportHash, result.result, {
      model: ModelTier.BALANCED,
      tokens_saved: this.estimateTokens(JSON.stringify(reportData)),
      workspaceId
    });

    console.log(`${ICONS.SUCCESS} Relatório concluído e cacheado`);
    return result.result;
  }

  /**
   * Processa com modelo específico (chama API Python da v1)
   */
  private async processWithModel(
    text: string,
    modelTier: ModelTier,
    analysisType: string
  ): Promise<any> {
    try {
      const response = await fetch('http://localhost:8000/api/ai/analyze-with-routing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          forced_model: modelTier,
          analysis_type: analysisType,
          cache_enabled: true
        })
      });

      if (!response.ok) {
        throw new Error(`API Python retornou erro: ${response.status}`);
      }

      const result = await response.json();

      // Adicionar informações de routing
      result._routing_info = {
        ...result._routing_info,
        final_tier: modelTier,
        analysis_type: analysisType,
        cost_estimate: this.calculateCost(this.estimateTokens(text), 2000, modelTier),
        cached: false,
        timestamp: new Date().toISOString()
      };

      return result;

    } catch (error) {
      const { ICONS } = await import('./icons');
      console.error(`${ICONS.ERROR} Erro na análise com ${modelTier}:`, error);

      // Fallback para tier inferior em caso de erro
      if (modelTier === ModelTier.PRO) {
        console.log(`${ICONS.WARNING} Fallback PRO → BALANCED`);
        return this.processWithModel(text, ModelTier.BALANCED, analysisType);
      } else if (modelTier === ModelTier.BALANCED) {
        console.log(`${ICONS.WARNING} Fallback BALANCED → LITE`);
        return this.processWithModel(text, ModelTier.LITE, analysisType);
      }

      throw error;
    }
  }
}
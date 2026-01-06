// ================================================================
// AI UNIFIED PROCESS SCHEMA - Legal Document Structure
// ================================================================
// Defines the standardized schema for legal document analysis
// Used across all AI models for consistent output

/**
 * UNIFIED PROCESS SCHEMA - Based on report_generator.py V1
 * This schema serves as a guide for all Gemini models
 */
export interface UnifiedProcessSchema {
    // ========== SECTION A: BASIC IDENTIFICATION ==========
    identificacao_basica: {
        numero_processo: string | null;
        tipo_processual: string | null;
        esfera: 'Federal' | 'Estadual' | 'Municipal' | 'Trabalhista' | null;
        orgao_instancia: string | null;
        comarca: string | null;
        vara: string | null;
        juiz_responsavel: string | null;
    };

    // ========== SECTION B: INVOLVED PARTIES ==========
    partes_envolvidas: {
        parte_principal: {
            nome: string | null;
            cpf_cnpj: string | null;
            tipo: 'Física' | 'Jurídica' | null;
            qualificacao: string | null;
        };
        parte_contraria: {
            nome: string | null;
            cpf_cnpj: string | null;
            tipo: 'Física' | 'Jurídica' | null;
            qualificacao: string | null;
        };
        outras_partes: Array<{
            nome: string;
            cpf_cnpj: string | null;
            qualificacao: string;
        }> | null;
    };

    // ========== SECTION C: VALUES AND FINANCIAL ==========
    valores_financeiros: {
        valor_principal: number | null;
        multas: number | null;
        juros: number | null;
        encargos_legais: number | null;
        valor_total: number | null;
        valor_atualizado_em: string | null;
        observacoes_valores: string | null;
    };

    // ========== SECTION D: SPECIALIZED FIELDS BY TYPE ==========
    campos_especializados: {
        execucao_fiscal?: {
            cdas_numeros: string[] | null;
            valor_originario: number | null;
            multas_fiscais: number | null;
            inscricao_divida_ativa: string | null;
        };
        acao_civil?: {
            pedido_principal: string | null;
            causa_pedir: string | null;
            valor_causa: number | null;
        };
        trabalhista?: {
            ctps: string | null;
            salario_base: number | null;
            periodo_trabalho: string | null;
            verbas_rescisórias: number | null;
        };
        previdenciario?: {
            beneficio_requerido: string | null;
            dib: string | null;
            rmi: number | null;
            auxilio_doenca: boolean | null;
        };
        familia?: {
            regime_bens: string | null;
            guarda_filhos: string | null;
            pensao_alimenticia: number | null;
        };
        consumidor?: {
            relacao_consumo: string | null;
            defeito_vicio: string | null;
            dano_moral_material: string | null;
        };
        penal?: {
            tipo_penal: string | null;
            pena_aplicada: string | null;
            regime_cumprimento: string | null;
        };
        empresarial?: {
            cnpj: string | null;
            atividade_empresarial: string | null;
            dissolucao_sociedade: boolean | null;
        };
    };

    // ========== SECTION E: STATUS AND PROCEEDINGS ==========
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

    // ========== SECTION F: RISK ANALYSIS AND STRATEGY ==========
    analise_estrategica: {
        tese_juridica_central: string | null;
        risco_classificacao: 'Provável' | 'Possível' | 'Remoto' | null;
        risco_justificativa: string | null;
        oportunidades_processuais: string[] | null;
        recomendacoes_estrategicas: string[] | null;
        pontos_atencao: string[] | null;
        precedentes_relevantes: string[] | null;
    };

    // ========== SECTION G: RELATED DOCUMENTS ==========
    documentos_relacionados: {
        documentos_anexos: Array<{
            nome: string;
            tipo: string;
            data_juntada: string;
        }> | null;
        certidoes_pendentes: string[] | null;
        documentos_solicitados: string[] | null;
    };

    // ========== SECTION H: ANALYSIS METADATA ==========
    metadados_analise: {
        data_analise: string;
        modelo_utilizado: string;
        confianca_geral: number;
        observacoes_ia: string | null;
        campos_nao_encontrados: string[] | null;
        tipo_documento_detectado?: string;
    };
}

/**
 * Multi-front analysis additional fields
 */
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
}

/**
 * Extended schema with multi-front analysis
 */
export interface UnifiedProcessSchemaWithFronts extends UnifiedProcessSchema {
    frentes_discussao?: FrenteDiscussao[];
    resumo_executivo_frentes?: string;
}

/**
 * Returns the unified schema as JSON string for prompts
 */
export function getUnifiedSchemaForPrompt(): string {
    return JSON.stringify({
        identificacao_basica: {
            numero_processo: 'string | null',
            tipo_processual: 'string | null',
            esfera: 'Federal | Estadual | Municipal | Trabalhista | null',
            orgao_instancia: 'string | null',
            comarca: 'string | null',
            vara: 'string | null',
            juiz_responsavel: 'string | null'
        },
        partes_envolvidas: {
            parte_principal: {
                nome: 'string | null',
                cpf_cnpj: 'string | null',
                tipo: 'Física | Jurídica | null',
                qualificacao: 'string | null'
            },
            parte_contraria: {
                nome: 'string | null',
                cpf_cnpj: 'string | null',
                tipo: 'Física | Jurídica | null',
                qualificacao: 'string | null'
            },
            outras_partes: 'Array<{nome, cpf_cnpj, qualificacao}> | null'
        },
        valores_financeiros: {
            valor_principal: 'number | null',
            multas: 'number | null',
            juros: 'number | null',
            encargos_legais: 'number | null',
            valor_total: 'number | null',
            valor_atualizado_em: 'string | null',
            observacoes_valores: 'string | null'
        },
        campos_especializados: 'Objeto específico baseado no tipo de processo identificado',
        situacao_processual: {
            situacao_atual: 'string | null',
            fase_processual: 'string | null',
            ultimo_andamento: 'objeto com data, tipo, resumo',
            principais_andamentos: 'Array de objetos com data, tipo, resumo',
            prazos_pendentes: 'Array de objetos | null'
        },
        frentes_discussao: {
            frentes_ativas: 'Array de objetos com nome_frente, status_atual, proximos_passos, prazos_correndo',
            resumo_executivo_frentes: 'string',
            prioridades_identificadas: 'Array de strings'
        },
        analise_estrategica: {
            tese_juridica_central: 'string | null',
            risco_classificacao: 'Provável | Possível | Remoto | null',
            risco_justificativa: 'string | null',
            oportunidades_processuais: 'Array<string> | null',
            recomendacoes_estrategicas: 'Array<string> | null',
            pontos_atencao: 'Array<string> | null',
            precedentes_relevantes: 'Array<string> | null'
        },
        documentos_relacionados: {
            documentos_anexos: 'Array de objetos | null',
            certidoes_pendentes: 'Array<string> | null',
            documentos_solicitados: 'Array<string> | null'
        },
        metadados_analise: {
            data_analise: 'string',
            modelo_utilizado: 'string',
            confianca_geral: 'number 0-1',
            observacoes_ia: 'string | null',
            campos_nao_encontrados: 'Array<string> | null'
        }
    }, null, 2);
}

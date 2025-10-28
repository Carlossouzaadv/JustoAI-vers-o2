/**
 * Prompt para Enriquecimento de Eventos de Timeline
 *
 * Usado para enriquecer descrições de andamentos processuais
 * mantendo concisão e estrutura.
 */

/**
 * Constrói prompt para enriquecimento de evento timeline
 *
 * Objetivo: Reescrever evento base adicionando contexto do documento
 * sem inventar informações.
 *
 * Exemplo:
 * Base: "Juntada de Petição"
 * Contexto: "Réplica apresentada pela autora Maria Silva..."
 * Resultado: "Juntada de Réplica por Maria Silva sobre danos morais"
 */
export function buildEnrichmentPrompt(
  baseDescription: string,
  contextualDescription: string,
  documentName?: string
): string {
  const documentRef = documentName
    ? `(extraído de: "${documentName}")`
    : '(extraído de documento)';

  return `Você é um especialista em processos judiciais. Sua tarefa é enriquecer uma descrição de andamento processual com contexto adicional.

EVENTO BASE (fonte oficial JUDIT):
"${baseDescription}"

CONTEXTO ADICIONAL ${documentRef}:
"${contextualDescription}"

INSTRUÇÕES (IMPORTANTES):
1. Mantenha a estrutura e o tipo do evento base
2. Incorpore APENAS informações relevantes do contexto (partes, assunto, detalhes jurídicos específicos)
3. Seja conciso (máximo 180 caracteres)
4. Nunca invente ou deduza informações não presentes
5. Se o contexto não adiciona informação útil, retorne o evento base inalterado
6. Priorize: partes envolvidas > assunto jurídico > detalhes secundários
7. Use linguagem jurídica clara e formal

EXEMPLOS DE ENRIQUECIMENTO BOM:
Base: "Juntada de Petição"
Contexto: "Réplica da autora Maria Silva contestando preliminar sobre incompetência"
Resultado: "Juntada de Réplica por Maria Silva contestando incompetência"

Base: "Sentença"
Contexto: "Sentença que acolhe o pedido de danos morais em favor do autor"
Resultado: "Sentença acolhendo danos morais a favor do autor"

Base: "Audiência"
Contexto: "Audiência de instrução realizada no juizado especial cível"
Resultado: "Audiência de instrução - Juizado Especial Cível"

EXEMPLO DE NÃO ENRIQUECIMENTO:
Base: "Despacho"
Contexto: "Despacho do juiz marcando nova data"
Resultado: "Despacho" (contexto não adiciona info relevante)

RESPOSTA:
Retorne APENAS o texto enriquecido, sem explicações, sem aspas, sem quebras de linha.
Se não conseguir enriquecer, retorne o evento base original inalterado.
`;
}

/**
 * Validação básica do prompt
 */
export function validateEnrichmentInput(
  baseDescription: string,
  contextualDescription: string
): boolean {
  // Ambos devem ter conteúdo
  if (!baseDescription?.trim() || !contextualDescription?.trim()) {
    return false;
  }

  // Base não pode ser muito longa
  if (baseDescription.length > 500) {
    return false;
  }

  // Contexto não pode ser vazio
  if (contextualDescription.length < 10) {
    return false;
  }

  return true;
}

/**
 * Limpa resposta da IA (remove espaços extras, aspas, etc)
 */
export function cleanEnrichmentOutput(output: string): string {
  return output
    .trim()
    .replace(/^["']|["']$/g, '') // Remove aspas no início/fim
    .replace(/[\r\n]+/g, ' ') // Remove quebras de linha
    .replace(/\s+/g, ' ') // Normaliza espaços
    .substring(0, 250); // Garante tamanho máximo
}

/**
 * Variações de prompt (para testes A/B futuros)
 */
export const ENRICHMENT_PROMPTS = {
  v1: buildEnrichmentPrompt, // Versão atual

  /**
   * Versão simplificada para teste
   */
  v2_simple: (
    baseDescription: string,
    contextualDescription: string,
    _documentName?: string
  ): string => {
    return `Enriqueça este andamento jurídico adicionando contexto, mantendo máximo 180 caracteres.
Base: "${baseDescription}"
Contexto: "${contextualDescription}"
Resultado (apenas texto enriquecido):`;
  },

  /**
   * Versão estruturada (se quisermos JSON estruturado no futuro)
   */
  v3_structured: (
    baseDescription: string,
    contextualDescription: string,
    _documentName?: string
  ): string => {
    return `Analise este andamento processual e retorne em JSON:
{
  "enriched_description": "descrição enriquecida ou base",
  "added_parties": ["parte1", "parte2"],
  "added_subject": "assunto adicionado",
  "was_enriched": true/false
}

Base: "${baseDescription}"
Contexto: "${contextualDescription}"`;
  },
};

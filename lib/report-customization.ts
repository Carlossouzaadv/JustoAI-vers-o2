// ================================
// SISTEMA DE PERSONALIZAÇÃO DE RELATÓRIOS
// ================================
// Gerenciamento de logos, cabeçalhos, rodapés e branding por cliente

import { ICONS } from './icons';
import prisma from './prisma';

// ================================
// TIPOS E INTERFACES
// ================================

export interface CustomizationProfile {
  id: string;
  workspaceId: string;
  profileName: string;
  isDefault: boolean;

  // Branding
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;

  // Cores
  primaryColor: string;     // #1E40AF
  secondaryColor: string;   // #64748B
  accentColor: string;      // #10B981
  backgroundColor: string;  // #FFFFFF
  textColor: string;        // #1F2937

  // Logo e imagens
  logoUrl?: string;         // URL da imagem
  logoBase64?: string;      // Base64 da imagem
  logoWidth?: number;       // Largura em pixels
  logoHeight?: number;      // Altura em pixels
  logoPosition: 'left' | 'center' | 'right';

  // Cabeçalho personalizado
  headerText?: string;
  headerHeight?: number;
  showCompanyInfo: boolean;
  showGenerationInfo: boolean;

  // Rodapé personalizado
  footerText?: string;
  footerHeight?: number;
  showPageNumbers: boolean;
  showGeneratedBy: boolean;

  // Watermark
  watermark?: string;
  watermarkOpacity?: number;
  watermarkRotation?: number;

  // Configurações avançadas
  fontSize: number;         // 12
  fontFamily: string;       // 'Segoe UI'
  lineHeight: number;       // 1.4
  marginTop: number;        // 20mm
  marginRight: number;      // 15mm
  marginBottom: number;     // 20mm
  marginLeft: number;       // 15mm

  createdAt: Date;
  updatedAt: Date;
}

export interface LogoUploadResult {
  success: boolean;
  logoUrl?: string;
  logoBase64?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  error?: string;
}

// ================================
// CLASSE DE GERENCIAMENTO
// ================================

export class ReportCustomizationManager {

  // ================================
  // PROFILES DE CUSTOMIZAÇÃO
  // ================================

  /**
   * Cria um novo perfil de customização
   */
  async createProfile(
    workspaceId: string,
    profileData: Partial<CustomizationProfile>
  ): Promise<CustomizationProfile> {
    try {
      console.log(`${ICONS.PROCESS} Criando perfil de customização: ${profileData.profileName}`);

      // Se é o primeiro perfil, marca como padrão
      const existingProfiles = await this.getProfilesByWorkspace(workspaceId);
      const isDefault = profileData.isDefault ?? (existingProfiles.length === 0);

      // Se está marcando como padrão, desmarcar outros
      if (isDefault) {
        await prisma.reportCustomization.updateMany({
          where: { workspaceId, isDefault: true },
          data: { isDefault: false }
        });
      }

      const profile = await prisma.reportCustomization.create({
        data: {
          workspaceId,
          profileName: profileData.profileName || 'Perfil Padrão',
          isDefault,

          // Branding
          companyName: profileData.companyName || 'Empresa',
          companyAddress: profileData.companyAddress,
          companyPhone: profileData.companyPhone,
          companyEmail: profileData.companyEmail,
          companyWebsite: profileData.companyWebsite,

          // Cores padrão
          primaryColor: profileData.primaryColor || '#1E40AF',
          secondaryColor: profileData.secondaryColor || '#64748B',
          accentColor: profileData.accentColor || '#10B981',
          backgroundColor: profileData.backgroundColor || '#FFFFFF',
          textColor: profileData.textColor || '#1F2937',

          // Logo
          logoUrl: profileData.logoUrl,
          logoBase64: profileData.logoBase64,
          logoWidth: profileData.logoWidth || 80,
          logoHeight: profileData.logoHeight || 60,
          logoPosition: profileData.logoPosition || 'left',

          // Cabeçalho
          headerText: profileData.headerText,
          headerHeight: profileData.headerHeight || 60,
          showCompanyInfo: profileData.showCompanyInfo ?? true,
          showGenerationInfo: profileData.showGenerationInfo ?? true,

          // Rodapé
          footerText: profileData.footerText,
          footerHeight: profileData.footerHeight || 30,
          showPageNumbers: profileData.showPageNumbers ?? true,
          showGeneratedBy: profileData.showGeneratedBy ?? true,

          // Watermark
          watermark: profileData.watermark,
          watermarkOpacity: profileData.watermarkOpacity || 0.05,
          watermarkRotation: profileData.watermarkRotation || -45,

          // Typography e layout
          fontSize: profileData.fontSize || 12,
          fontFamily: profileData.fontFamily || 'Segoe UI',
          lineHeight: profileData.lineHeight || 1.4,
          marginTop: profileData.marginTop || 20,
          marginRight: profileData.marginRight || 15,
          marginBottom: profileData.marginBottom || 20,
          marginLeft: profileData.marginLeft || 15
        }
      });

      console.log(`${ICONS.SUCCESS} Perfil criado: ${profile.id}`);
      return profile as CustomizationProfile;

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao criar perfil:`, error);
      throw error;
    }
  }

  /**
   * Busca todos os perfis de um workspace
   */
  async getProfilesByWorkspace(workspaceId: string): Promise<CustomizationProfile[]> {
    const profiles = await prisma.reportCustomization.findMany({
      where: { workspaceId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return profiles as CustomizationProfile[];
  }

  /**
   * Busca o perfil padrão de um workspace
   */
  async getDefaultProfile(workspaceId: string): Promise<CustomizationProfile | null> {
    const profile = await prisma.reportCustomization.findFirst({
      where: {
        workspaceId,
        isDefault: true
      }
    });

    return profile as CustomizationProfile | null;
  }

  /**
   * Busca perfil por ID
   */
  async getProfileById(profileId: string): Promise<CustomizationProfile | null> {
    const profile = await prisma.reportCustomization.findUnique({
      where: { id: profileId }
    });

    return profile as CustomizationProfile | null;
  }

  /**
   * Atualiza um perfil
   */
  async updateProfile(
    profileId: string,
    updates: Partial<CustomizationProfile>
  ): Promise<CustomizationProfile> {
    try {
      console.log(`${ICONS.PROCESS} Atualizando perfil: ${profileId}`);

      // Se está marcando como padrão, desmarcar outros do mesmo workspace
      if (updates.isDefault) {
        const currentProfile = await this.getProfileById(profileId);
        if (currentProfile) {
          await prisma.reportCustomization.updateMany({
            where: {
              workspaceId: currentProfile.workspaceId,
              isDefault: true,
              id: { not: profileId }
            },
            data: { isDefault: false }
          });
        }
      }

      const profile = await prisma.reportCustomization.update({
        where: { id: profileId },
        data: {
          ...updates,
          updatedAt: new Date()
        }
      });

      console.log(`${ICONS.SUCCESS} Perfil atualizado: ${profileId}`);
      return profile as CustomizationProfile;

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao atualizar perfil:`, error);
      throw error;
    }
  }

  /**
   * Remove um perfil
   */
  async deleteProfile(profileId: string): Promise<void> {
    try {
      console.log(`${ICONS.WARNING} Removendo perfil: ${profileId}`);

      const profile = await this.getProfileById(profileId);
      if (!profile) {
        throw new Error('Perfil não encontrado');
      }

      // Se é o perfil padrão, marcar outro como padrão
      if (profile.isDefault) {
        const otherProfiles = await this.getProfilesByWorkspace(profile.workspaceId);
        const nextProfile = otherProfiles.find(p => p.id !== profileId);

        if (nextProfile) {
          await this.updateProfile(nextProfile.id, { isDefault: true });
        }
      }

      await prisma.reportCustomization.delete({
        where: { id: profileId }
      });

      console.log(`${ICONS.SUCCESS} Perfil removido: ${profileId}`);

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro ao remover perfil:`, error);
      throw error;
    }
  }

  // ================================
  // GERENCIAMENTO DE LOGOS
  // ================================

  /**
   * Faz upload de logo e retorna dados processados
   */
  async uploadLogo(
    profileId: string,
    logoFile: Buffer,
    mimeType: string
  ): Promise<LogoUploadResult> {
    try {
      console.log(`${ICONS.PROCESS} Processando upload de logo...`);

      // Validar tipo de arquivo
      if (!['image/jpeg', 'image/png', 'image/svg+xml'].includes(mimeType)) {
        return {
          success: false,
          error: 'Formato de imagem não suportado. Use JPEG, PNG ou SVG.'
        };
      }

      // Validar tamanho (máximo 2MB)
      if (logoFile.length > 2 * 1024 * 1024) {
        return {
          success: false,
          error: 'Arquivo muito grande. Máximo 2MB.'
        };
      }

      // Converter para Base64
      const logoBase64 = `data:${mimeType};base64,${logoFile.toString('base64')}`;

      // Detectar dimensões (implementação básica)
      let width = 80;
      let height = 60;

      // Para PNG/JPEG, poderia usar uma lib para detectar dimensões reais
      // Por simplicidade, usando valores padrão

      // Salvar no perfil
      await this.updateProfile(profileId, {
        logoBase64,
        logoWidth: width,
        logoHeight: height
      });

      console.log(`${ICONS.SUCCESS} Logo salvo (${Math.round(logoFile.length / 1024)}KB)`);

      return {
        success: true,
        logoBase64,
        width,
        height,
        fileSize: logoFile.length
      };

    } catch (error) {
      console.error(`${ICONS.ERROR} Erro no upload de logo:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Remove logo de um perfil
   */
  async removeLogo(profileId: string): Promise<void> {
    await this.updateProfile(profileId, {
      logoUrl: null,
      logoBase64: null
    });

    console.log(`${ICONS.SUCCESS} Logo removido do perfil: ${profileId}`);
  }

  // ================================
  // TEMPLATES PRÉ-DEFINIDOS
  // ================================

  /**
   * Cria perfil baseado em template
   */
  async createFromTemplate(
    workspaceId: string,
    templateName: string,
    companyName: string
  ): Promise<CustomizationProfile> {
    const templates = this.getTemplates();
    const template = templates.find(t => t.name === templateName);

    if (!template) {
      throw new Error(`Template não encontrado: ${templateName}`);
    }

    return await this.createProfile(workspaceId, {
      ...template.config,
      profileName: `${companyName} - ${template.name}`,
      companyName
    });
  }

  /**
   * Lista templates disponíveis
   */
  getTemplates() {
    return [
      {
        name: 'Corporativo Azul',
        description: 'Design profissional com tons de azul',
        preview: '/templates/corporativo-azul.png',
        config: {
          primaryColor: '#1E40AF',
          secondaryColor: '#64748B',
          accentColor: '#3B82F6',
          fontFamily: 'Segoe UI',
          fontSize: 12,
          showPageNumbers: true,
          showGenerationInfo: true
        }
      },
      {
        name: 'Jurídico Elegante',
        description: 'Estilo clássico para escritórios de advocacia',
        preview: '/templates/juridico-elegante.png',
        config: {
          primaryColor: '#1F2937',
          secondaryColor: '#6B7280',
          accentColor: '#D97706',
          fontFamily: 'Georgia',
          fontSize: 11,
          showPageNumbers: true,
          watermark: 'CONFIDENCIAL'
        }
      },
      {
        name: 'Moderno Verde',
        description: 'Design contemporâneo com cores verdes',
        preview: '/templates/moderno-verde.png',
        config: {
          primaryColor: '#059669',
          secondaryColor: '#6B7280',
          accentColor: '#10B981',
          fontFamily: 'Inter',
          fontSize: 12,
          showPageNumbers: true,
          showGenerationInfo: true
        }
      }
    ];
  }

  // ================================
  // CONVERSÃO PARA TEMPLATE ENGINE
  // ================================

  /**
   * Converte perfil para formato usado pelos templates
   */
  profileToCustomization(profile: CustomizationProfile): any {
    return {
      client_logo: profile.logoBase64 || profile.logoUrl,
      company_name: profile.companyName,
      company_address: profile.companyAddress,
      primary_color: profile.primaryColor,
      secondary_color: profile.secondaryColor,
      accent_color: profile.accentColor,
      header_text: profile.headerText,
      footer_text: profile.footerText,
      show_page_numbers: profile.showPageNumbers,
      watermark: profile.watermark
    };
  }

  // ================================
  // PRÉVIA DE RELATÓRIO
  // ================================

  /**
   * Gera HTML de prévia sem gerar PDF
   */
  async generatePreview(
    profileId: string,
    reportType: 'complete' | 'updates' | 'executive' = 'executive'
  ): Promise<string> {
    const profile = await this.getProfileById(profileId);
    if (!profile) {
      throw new Error('Perfil não encontrado');
    }

    const { generateReportTemplate } = await import('./report-templates');

    // Dados de exemplo para prévia
    const sampleData = this.generateSampleData();
    const customization = this.profileToCustomization(profile);

    return generateReportTemplate(reportType, sampleData, customization);
  }

  private generateSampleData(): any {
    return {
      title: 'Relatório Executivo - Prévia',
      subtitle: 'Exemplo de relatório personalizado',
      generated_at: new Date(),
      generated_by: 'Sistema JustoAI',
      workspace_name: 'Workspace de Exemplo',
      summary: {
        total_processes: 25,
        active_processes: 18,
        new_movements: 7,
        critical_alerts: 3,
        pending_actions: 5
      },
      processes: [
        {
          id: '1',
          number: '1234567-12.2023.8.26.0001',
          client_name: 'Cliente Exemplo Ltda',
          subject: 'Ação de Cobrança',
          court: 'TJSP',
          status: 'ACTIVE',
          priority: 'HIGH' as const,
          last_movement: {
            date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            description: 'Juntada de petição da parte autora solicitando cumprimento de sentença',
            requires_action: true
          },
          next_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      ],
      insights: [
        'Identificados 3 processos com prazo vencendo em 7 dias',
        'Aumento de 15% nas movimentações em relação ao mês anterior',
        'Sugerida revisão dos processos de alta prioridade'
      ]
    };
  }
}

// ================================
// INSTÂNCIA SINGLETON
// ================================

let globalCustomizationManager: ReportCustomizationManager | null = null;

/**
 * Obtém a instância global do gerenciador
 */
export function getCustomizationManager(): ReportCustomizationManager {
  if (!globalCustomizationManager) {
    globalCustomizationManager = new ReportCustomizationManager();
  }
  return globalCustomizationManager;
}

export default ReportCustomizationManager;
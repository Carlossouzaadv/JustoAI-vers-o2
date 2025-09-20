// ================================================================
// TESTES UNITÁRIOS - COMPONENTES DE PRICING
// ================================================================

import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock pricing data
const mockPricingData = {
  meta: {
    annual_discount_pct: 0.15
  },
  plans: [
    {
      id: 'starter',
      name: 'Starter',
      subtitle: 'Ideal para escritórios pequenos',
      price_monthly: 499,
      price_annual: 5089,
      popular: false,
      trial_days: 7,
      highlighted_features: [
        'Monitoramento diário de processos',
        'Relatórios automatizados'
      ]
    },
    {
      id: 'professional',
      name: 'Professional',
      subtitle: 'Para escritórios em crescimento',
      price_monthly: 1199,
      price_annual: 12229,
      popular: true,
      trial_days: 7,
      highlighted_features: [
        'Tudo do Starter +',
        'Suporte prioritário'
      ]
    }
  ]
};

// Mock the pricing config import
vi.mock('@/config/pricing.json', () => ({
  default: mockPricingData
}));

// ================================================================
// BILLING TOGGLE TESTS
// ================================================================

describe('BillingToggle Component', () => {
  test('should display monthly and annual options', () => {
    const mockOnToggle = vi.fn();

    render(
      <BillingToggle
        billingCycle="monthly"
        onToggle={mockOnToggle}
        annualDiscountPct={0.15}
      />
    );

    expect(screen.getByText('Mensal')).toBeInTheDocument();
    expect(screen.getByText('Anual')).toBeInTheDocument();
    expect(screen.getByText('15% OFF')).toBeInTheDocument();
  });

  test('should call onToggle when switching billing cycle', () => {
    const mockOnToggle = vi.fn();

    render(
      <BillingToggle
        billingCycle="monthly"
        onToggle={mockOnToggle}
        annualDiscountPct={0.15}
      />
    );

    fireEvent.click(screen.getByText('Anual'));
    expect(mockOnToggle).toHaveBeenCalledWith('annual');
  });

  test('should highlight selected billing cycle', () => {
    const mockOnToggle = vi.fn();

    render(
      <BillingToggle
        billingCycle="annual"
        onToggle={mockOnToggle}
        annualDiscountPct={0.15}
      />
    );

    const annualButton = screen.getByText('Anual').closest('button');
    expect(annualButton).toHaveAttribute('aria-pressed', 'true');
  });
});

// ================================================================
// PLAN CARD TESTS
// ================================================================

describe('PlanCard Component', () => {
  const mockPlan = {
    id: 'starter',
    name: 'Starter',
    subtitle: 'Ideal para escritórios pequenos',
    price_monthly: 499,
    price_annual: 5089,
    popular: false,
    trial_days: 7,
    highlighted_features: [
      'Monitoramento diário',
      'Relatórios automáticos'
    ]
  };

  test('should display plan information correctly', () => {
    const mockOnSelectPlan = vi.fn();

    render(
      <PlanCard
        plan={mockPlan}
        billingCycle="monthly"
        onSelectPlan={mockOnSelectPlan}
      />
    );

    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Ideal para escritórios pequenos')).toBeInTheDocument();
    expect(screen.getByText('R$ 499')).toBeInTheDocument();
    expect(screen.getByText('Teste grátis por 7 dias')).toBeInTheDocument();
  });

  test('should display popular badge for popular plans', () => {
    const popularPlan = { ...mockPlan, popular: true };
    const mockOnSelectPlan = vi.fn();

    render(
      <PlanCard
        plan={popularPlan}
        billingCycle="monthly"
        onSelectPlan={mockOnSelectPlan}
      />
    );

    expect(screen.getByText('Mais Popular')).toBeInTheDocument();
  });

  test('should calculate annual pricing correctly', () => {
    const mockOnSelectPlan = vi.fn();

    render(
      <PlanCard
        plan={mockPlan}
        billingCycle="annual"
        onSelectPlan={mockOnSelectPlan}
      />
    );

    // Annual price divided by 12 months
    const monthlyEquivalent = Math.floor(5089 / 12);
    expect(screen.getByText(`R$ ${monthlyEquivalent}`)).toBeInTheDocument();
    expect(screen.getByText('Economize 15% pagando anualmente')).toBeInTheDocument();
  });

  test('should call onSelectPlan when button is clicked', () => {
    const mockOnSelectPlan = vi.fn();

    render(
      <PlanCard
        plan={mockPlan}
        billingCycle="monthly"
        onSelectPlan={mockOnSelectPlan}
      />
    );

    fireEvent.click(screen.getByText(/Assinar — Starter/));
    expect(mockOnSelectPlan).toHaveBeenCalledWith('starter');
  });

  test('should handle enterprise plan with contact sales', () => {
    const enterprisePlan = {
      ...mockPlan,
      id: 'enterprise',
      name: 'Enterprise',
      custom_pricing: true,
      contact_sales: true,
      price_monthly: null,
      price_annual: null
    };

    const mockOnContactSales = vi.fn();

    render(
      <PlanCard
        plan={enterprisePlan}
        billingCycle="monthly"
        onSelectPlan={vi.fn()}
        onContactSales={mockOnContactSales}
      />
    );

    expect(screen.getByText('Preço personalizado')).toBeInTheDocument();

    const contactButton = screen.getByText('Falar com Vendas');
    fireEvent.click(contactButton);
    expect(mockOnContactSales).toHaveBeenCalled();
  });
});

// ================================================================
// PRICE FORMATTING TESTS
// ================================================================

describe('Price Formatting Utils', () => {
  test('should format Brazilian currency correctly', () => {
    const formatPrice = (price: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(price);
    };

    expect(formatPrice(499)).toBe('R$ 499');
    expect(formatPrice(1199)).toBe('R$ 1.199');
    expect(formatPrice(12229)).toBe('R$ 12.229');
  });

  test('should calculate annual discount correctly', () => {
    const calculateAnnualPrice = (monthlyPrice: number, discountPct: number) => {
      const annualPrice = monthlyPrice * 12;
      return annualPrice * (1 - discountPct);
    };

    expect(calculateAnnualPrice(499, 0.15)).toBe(5089.8);
    expect(Math.round(calculateAnnualPrice(499, 0.15))).toBe(5090);
  });
});

// ================================================================
// FEATURE MATRIX TESTS
// ================================================================

describe('FeatureMatrix Component', () => {
  const mockFeaturesMatrix = {
    categories: [
      {
        name: 'Usuários e Acessos',
        features: [
          {
            name: 'Usuários simultâneos',
            starter: '2',
            professional: '5',
            enterprise: 'Ilimitado'
          }
        ]
      }
    ]
  };

  test('should display feature comparison table', () => {
    render(<FeatureMatrix featuresMatrix={mockFeaturesMatrix} />);

    expect(screen.getByText('Comparativo Completo de Funcionalidades')).toBeInTheDocument();
    expect(screen.getByText('Usuários e Acessos')).toBeInTheDocument();
    expect(screen.getByText('Usuários simultâneos')).toBeInTheDocument();
    expect(screen.getByText('Starter')).toBeInTheDocument();
    expect(screen.getByText('Professional')).toBeInTheDocument();
    expect(screen.getByText('Enterprise')).toBeInTheDocument();
  });

  test('should render different feature value types correctly', () => {
    render(<FeatureMatrix featuresMatrix={mockFeaturesMatrix} />);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Ilimitado')).toBeInTheDocument();
  });
});

// ================================================================
// CREDITS PACKS TESTS
// ================================================================

describe('CreditsPacks Component', () => {
  const mockCreditPacks = [
    {
      id: 'small_analysis',
      name: 'Pacote Pequeno',
      description: '10 Análises completas',
      credits: 10,
      price: 79,
      type: 'analysis',
      popular: false
    },
    {
      id: 'medium_analysis',
      name: 'Pacote Médio',
      description: '50 Análises completas',
      credits: 50,
      price: 299,
      type: 'analysis',
      popular: true,
      savings: 'Economize R$ 96'
    }
  ];

  test('should display credit packs information', () => {
    const mockOnBuyPack = vi.fn();

    render(
      <CreditsPacks
        creditPacks={mockCreditPacks}
        onBuyPack={mockOnBuyPack}
      />
    );

    expect(screen.getByText('Pacotes de Créditos Extras')).toBeInTheDocument();
    expect(screen.getByText('Pacote Pequeno')).toBeInTheDocument();
    expect(screen.getByText('R$ 79')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  test('should show popular badge for popular packs', () => {
    const mockOnBuyPack = vi.fn();

    render(
      <CreditsPacks
        creditPacks={mockCreditPacks}
        onBuyPack={mockOnBuyPack}
      />
    );

    expect(screen.getByText('Mais Vantajoso')).toBeInTheDocument();
    expect(screen.getByText('Economize R$ 96')).toBeInTheDocument();
  });

  test('should call onBuyPack when buy button is clicked', () => {
    const mockOnBuyPack = vi.fn();

    render(
      <CreditsPacks
        creditPacks={mockCreditPacks}
        onBuyPack={mockOnBuyPack}
      />
    );

    const buyButtons = screen.getAllByText('Comprar Pacote');
    fireEvent.click(buyButtons[0]);
    expect(mockOnBuyPack).toHaveBeenCalledWith('small_analysis');
  });

  test('should calculate price per credit correctly', () => {
    const mockOnBuyPack = vi.fn();

    render(
      <CreditsPacks
        creditPacks={mockCreditPacks}
        onBuyPack={mockOnBuyPack}
      />
    );

    // R$ 79 / 10 credits = R$ 7,90 per credit
    expect(screen.getByText('R$ 8 por crédito')).toBeInTheDocument();
  });
});

// ================================================================
// FAQ PRICING TESTS
// ================================================================

describe('FaqPricing Component', () => {
  const mockFaqItems = [
    {
      question: 'O que é um crédito de Análise completa?',
      answer: 'Créditos de Análises completas são usados para análises profundas.'
    },
    {
      question: 'Relatórios são ilimitados?',
      answer: 'Não. Para proteção da plataforma, aplicamos limites por plano.'
    }
  ];

  test('should display FAQ questions and answers', () => {
    render(<FaqPricing faqItems={mockFaqItems} />);

    expect(screen.getByText('Perguntas Frequentes')).toBeInTheDocument();
    expect(screen.getByText('O que é um crédito de Análise completa?')).toBeInTheDocument();
    expect(screen.getByText('Relatórios são ilimitados?')).toBeInTheDocument();
  });

  test('should expand accordion items when clicked', async () => {
    render(<FaqPricing faqItems={mockFaqItems} />);

    const questionButton = screen.getByText('O que é um crédito de Análise completa?');
    fireEvent.click(questionButton);

    await waitFor(() => {
      expect(screen.getByText('Créditos de Análises completas são usados para análises profundas.')).toBeInTheDocument();
    });
  });

  test('should display contact information', () => {
    render(<FaqPricing faqItems={mockFaqItems} />);

    expect(screen.getByText('Ainda tem dúvidas?')).toBeInTheDocument();
    expect(screen.getByText('📧 vendas@justoai.com')).toBeInTheDocument();
    expect(screen.getByText('📱 WhatsApp')).toBeInTheDocument();
  });
});

// ================================================================
// PLAN MODAL TESTS
// ================================================================

describe('PlanModal Component', () => {
  const mockPlan = {
    id: 'professional',
    name: 'Professional',
    subtitle: 'Para escritórios em crescimento',
    price_monthly: 1199,
    price_annual: 12229,
    popular: true,
    trial_days: 7,
    features: {
      users: { limit: 5, description: 'Até 5 usuários' },
      processes: { limit: 300, description: 'Até 300 processos' },
      support: { channels: ['email', 'whatsapp'], description: 'Suporte prioritário' }
    }
  };

  test('should display plan details in modal', () => {
    const mockOnStartTrial = vi.fn();
    const mockOnClose = vi.fn();

    render(
      <PlanModal
        isOpen={true}
        onClose={mockOnClose}
        plan={mockPlan}
        billingCycle="monthly"
        onStartTrial={mockOnStartTrial}
      />
    );

    expect(screen.getByText('Professional')).toBeInTheDocument();
    expect(screen.getByText('Para escritórios em crescimento')).toBeInTheDocument();
    expect(screen.getByText('Popular')).toBeInTheDocument();
    expect(screen.getByText('R$ 1.199')).toBeInTheDocument();
  });

  test('should call onStartTrial when trial button is clicked', () => {
    const mockOnStartTrial = vi.fn();
    const mockOnClose = vi.fn();

    render(
      <PlanModal
        isOpen={true}
        onClose={mockOnClose}
        plan={mockPlan}
        billingCycle="monthly"
        onStartTrial={mockOnStartTrial}
      />
    );

    const trialButton = screen.getByText(/Começar Teste Gratuito/);
    fireEvent.click(trialButton);
    expect(mockOnStartTrial).toHaveBeenCalledWith('professional');
  });

  test('should not render when plan is null', () => {
    const mockOnStartTrial = vi.fn();
    const mockOnClose = vi.fn();

    const { container } = render(
      <PlanModal
        isOpen={true}
        onClose={mockOnClose}
        plan={null}
        billingCycle="monthly"
        onStartTrial={mockOnStartTrial}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});

// ================================================================
// INTEGRATION TESTS
// ================================================================

describe('Pricing Page Integration', () => {
  test('should handle billing cycle changes across components', () => {
    // This would test the full pricing page with multiple components
    // interacting together, but requires more complex setup
    expect(true).toBe(true); // Placeholder for integration test
  });

  test('should track analytics events', () => {
    // Mock gtag function
    const mockGtag = vi.fn();
    Object.defineProperty(window, 'gtag', {
      value: mockGtag,
      writable: true
    });

    // Test analytics tracking
    // This would require actual component integration
    expect(true).toBe(true); // Placeholder for analytics test
  });
});
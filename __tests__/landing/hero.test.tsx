import { render, screen } from '@testing-library/react';
import { Hero } from '@/components/landing/hero';

// Mock Framer Motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
    section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
}));

// Mock Next.js components
jest.mock('next/link', () => {
  return ({ children, href }: any) => <a href={href}>{children}</a>;
});

jest.mock('next/image', () => {
  return ({ alt, ...props }: any) => <img alt={alt} {...props} />;
});

describe('Hero Component', () => {
  beforeEach(() => {
    render(<Hero />);
  });

  it('renders the main heading', () => {
    expect(screen.getByText('Transforme sua')).toBeInTheDocument();
    expect(screen.getByText('Advocacia')).toBeInTheDocument();
    expect(screen.getByText('com Inteligência Artificial')).toBeInTheDocument();
  });

  it('renders the value proposition', () => {
    expect(screen.getByText(/Elimine/)).toBeInTheDocument();
    expect(screen.getByText(/20 horas semanais/)).toBeInTheDocument();
    expect(screen.getByText(/impressionam e fidelizam/)).toBeInTheDocument();
  });

  it('renders the primary CTA button', () => {
    const ctaButton = screen.getByText('Começar Gratuitamente');
    expect(ctaButton).toBeInTheDocument();

    // Check if it's wrapped in a link to dashboard
    const link = ctaButton.closest('a');
    expect(link).toHaveAttribute('href', '/dashboard');
  });

  it('renders the secondary CTA button', () => {
    const demoButton = screen.getByText(/Ver Demo/);
    expect(demoButton).toBeInTheDocument();
  });

  it('displays trust indicators', () => {
    expect(screen.getByText('Sem cartão de crédito')).toBeInTheDocument();
    expect(screen.getByText('Setup em 5 minutos')).toBeInTheDocument();
    expect(screen.getByText('Suporte em português')).toBeInTheDocument();
  });

  it('shows the new feature badge', () => {
    expect(screen.getByText(/Novo: Sistema de Relatórios Automáticos/)).toBeInTheDocument();
  });

  it('displays floating stats', () => {
    expect(screen.getByText('20h')).toBeInTheDocument();
    expect(screen.getByText('economizadas/semana')).toBeInTheDocument();
    expect(screen.getByText('98%')).toBeInTheDocument();
    expect(screen.getByText('satisfação')).toBeInTheDocument();
  });

  it('has proper semantic structure', () => {
    // Check if hero is wrapped in a section
    const heroSection = screen.getByRole('region');
    expect(heroSection).toBeInTheDocument();

    // Check for proper heading hierarchy
    const mainHeading = screen.getByRole('heading', { level: 1 });
    expect(mainHeading).toBeInTheDocument();
  });

  it('has accessible button elements', () => {
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);

    buttons.forEach(button => {
      expect(button).toBeVisible();
    });
  });

  it('renders dashboard preview mockup', () => {
    // Check for dashboard preview elements
    expect(screen.getByText('JustoAI Dashboard')).toBeInTheDocument();
  });
});

describe('Hero Component Accessibility', () => {
  it('has proper ARIA labels and structure', () => {
    render(<Hero />);

    // Check for semantic elements
    const section = screen.getByRole('region');
    expect(section).toBeInTheDocument();

    // Check for proper heading structure
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
  });

  it('has focusable interactive elements', () => {
    render(<Hero />);

    const interactiveElements = [
      ...screen.getAllByRole('button'),
      ...screen.getAllByRole('link')
    ];

    interactiveElements.forEach(element => {
      expect(element).not.toHaveAttribute('tabindex', '-1');
    });
  });
});
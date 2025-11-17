// ================================================================
// BATCH ERRORS TABLE - TESTS
// ================================================================

import { render, screen } from '@testing-library/react';
import { BatchErrorsTable } from './batch-errors-table';

describe('BatchErrorsTable', () => {
  it('should display message when no errors', () => {
    render(
      <BatchErrorsTable
        errors={[]}
        errorSummary={{}}
        totalErrors={0}
      />
    );

    expect(screen.getByText('Nenhum erro encontrado durante o processamento')).toBeInTheDocument();
  });

  it('should render table with headers', () => {
    const errors = [
      { field: 'email', error: 'Invalid email format' },
      { field: 'phone', error: 'Invalid phone format' },
    ];
    const errorSummary = {
      'email: Invalid email format': 5,
      'phone: Invalid phone format': 3,
    };

    render(
      <BatchErrorsTable
        errors={errors}
        errorSummary={errorSummary}
        totalErrors={8}
      />
    );

    expect(screen.getByText('Erros Encontrados (8)')).toBeInTheDocument();
    expect(screen.getByText('Campo')).toBeInTheDocument();
    expect(screen.getByText('Erro')).toBeInTheDocument();
    expect(screen.getByText('Ocorrências')).toBeInTheDocument();
  });

  it('should display error details in table rows', () => {
    const errors = [
      { field: 'email', error: 'Invalid email format' },
      { field: 'phone', error: 'Invalid phone format' },
    ];
    const errorSummary = {
      'email: Invalid email format': 10,
      'phone: Invalid phone format': 5,
    };

    render(
      <BatchErrorsTable
        errors={errors}
        errorSummary={errorSummary}
        totalErrors={15}
      />
    );

    expect(screen.getByText('email')).toBeInTheDocument();
    expect(screen.getByText('phone')).toBeInTheDocument();
    expect(screen.getByText('Invalid email format')).toBeInTheDocument();
    expect(screen.getByText('Invalid phone format')).toBeInTheDocument();
  });

  it('should display error occurrence counts', () => {
    const errors = [
      { field: 'email', error: 'Invalid format', row: 5 },
    ];
    const errorSummary = {
      'email: Invalid format': 25,
    };

    render(
      <BatchErrorsTable
        errors={errors}
        errorSummary={errorSummary}
        totalErrors={25}
      />
    );

    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('should show row number when provided', () => {
    const errors = [
      { field: 'email', error: 'Invalid format', row: 42 },
    ];
    const errorSummary = {
      'email: Invalid format': 1,
    };

    render(
      <BatchErrorsTable
        errors={errors}
        errorSummary={errorSummary}
        totalErrors={1}
      />
    );

    expect(screen.getByText('Linha')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should not show row column when no errors have row info', () => {
    const errors = [
      { field: 'email', error: 'Invalid format' },
      { field: 'phone', error: 'Invalid format' },
    ];
    const errorSummary = {
      'email: Invalid format': 1,
      'phone: Invalid format': 1,
    };

    const { container } = render(
      <BatchErrorsTable
        errors={errors}
        errorSummary={errorSummary}
        totalErrors={2}
      />
    );

    const headers = container.querySelectorAll('th');
    const headerTexts = Array.from(headers).map((h) => h.textContent);

    expect(headerTexts).toContain('Campo');
    expect(headerTexts).toContain('Erro');
    expect(headerTexts).toContain('Ocorrências');
    expect(headerTexts).not.toContain('Linha');
  });

  it('should format error count in badge', () => {
    const errors = [
      { field: 'email', error: 'Invalid format' },
    ];
    const errorSummary = {
      'email: Invalid format': 123,
    };

    const { container } = render(
      <BatchErrorsTable
        errors={errors}
        errorSummary={errorSummary}
        totalErrors={123}
      />
    );

    const badge = container.querySelector('.rounded-full');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('123');
  });

  it('should handle multiple errors for same field', () => {
    const errors = [
      { field: 'email', error: 'Invalid format' },
      { field: 'email', error: 'Too long' },
      { field: 'email', error: 'Required' },
    ];
    const errorSummary = {
      'email: Invalid format': 10,
      'email: Too long': 5,
      'email: Required': 2,
    };

    render(
      <BatchErrorsTable
        errors={errors}
        errorSummary={errorSummary}
        totalErrors={17}
      />
    );

    expect(screen.getByText('Invalid format')).toBeInTheDocument();
    expect(screen.getByText('Too long')).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('should display title with AlertTriangle icon', () => {
    const errors = [
      { field: 'email', error: 'Invalid format' },
    ];
    const errorSummary = {
      'email: Invalid format': 5,
    };

    const { container } = render(
      <BatchErrorsTable
        errors={errors}
        errorSummary={errorSummary}
        totalErrors={5}
      />
    );

    expect(screen.getByText('Erros Encontrados (5)')).toBeInTheDocument();
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('should show descriptive text about errors', () => {
    const errors = [
      { field: 'email', error: 'Invalid format' },
    ];
    const errorSummary = {
      'email: Invalid format': 5,
    };

    render(
      <BatchErrorsTable
        errors={errors}
        errorSummary={errorSummary}
        totalErrors={5}
      />
    );

    expect(screen.getByText('Exibindo os erros mais comuns durante o processamento')).toBeInTheDocument();
  });

  it('should handle errors with all optional fields', () => {
    const errors = [
      {
        field: 'email',
        error: 'Invalid format',
        row: 10,
        retryCount: 2,
      },
    ];
    const errorSummary = {
      'email: Invalid format': 1,
    };

    render(
      <BatchErrorsTable
        errors={errors}
        errorSummary={errorSummary}
        totalErrors={1}
      />
    );

    expect(screen.getByText('email')).toBeInTheDocument();
    expect(screen.getByText('Invalid format')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('should apply correct styling to field names', () => {
    const errors = [
      { field: 'email', error: 'Invalid format' },
    ];
    const errorSummary = {
      'email: Invalid format': 1,
    };

    const { container } = render(
      <BatchErrorsTable
        errors={errors}
        errorSummary={errorSummary}
        totalErrors={1}
      />
    );

    const fieldCell = container.querySelector('.font-mono.text-sm.text-blue-600');
    expect(fieldCell).toBeInTheDocument();
    expect(fieldCell).toHaveTextContent('email');
  });
});

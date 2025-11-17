// ================================================================
// BATCH PROGRESS CARD - TESTS
// ================================================================

import { render, screen } from '@testing-library/react';
import { BatchProgressCard } from './batch-progress-card';

describe('BatchProgressCard', () => {
  it('should render progress bar with percentage', () => {
    render(
      <BatchProgressCard
        percentage={50}
        totalRows={100}
        processedRows={50}
        estimatedTimeRemaining={5}
        status="PROCESSING"
      />
    );

    expect(screen.getByText('Progresso do Processamento')).toBeInTheDocument();
    expect(screen.getByText('50 de 100 processados')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('should show completed status with green color', () => {
    const { container } = render(
      <BatchProgressCard
        percentage={100}
        totalRows={100}
        processedRows={100}
        estimatedTimeRemaining={0}
        status="COMPLETED"
      />
    );

    expect(screen.getByText('Concluído')).toBeInTheDocument();
    expect(screen.getByText('Processamento concluído com sucesso!')).toBeInTheDocument();
    expect(container.querySelector('.bg-green-500')).toBeInTheDocument();
  });

  it('should show failed status with red color', () => {
    const { container } = render(
      <BatchProgressCard
        percentage={100}
        totalRows={100}
        processedRows={100}
        estimatedTimeRemaining={0}
        status="FAILED"
      />
    );

    expect(screen.getByText('Falhou')).toBeInTheDocument();
    expect(screen.getByText('Processamento falhou. Veja os erros abaixo.')).toBeInTheDocument();
    expect(container.querySelector('.bg-red-500')).toBeInTheDocument();
  });

  it('should show processing status with spinning icon', () => {
    render(
      <BatchProgressCard
        percentage={25}
        totalRows={100}
        processedRows={25}
        estimatedTimeRemaining={3}
        status="PROCESSING"
      />
    );

    expect(screen.getByText('Processando')).toBeInTheDocument();
  });

  it('should display estimated time remaining', () => {
    render(
      <BatchProgressCard
        percentage={50}
        totalRows={100}
        processedRows={50}
        estimatedTimeRemaining={10}
        status="PROCESSING"
      />
    );

    expect(screen.getByText(/Tempo estimado:/)).toBeInTheDocument();
    expect(screen.getByText(/10 minutos/)).toBeInTheDocument();
  });

  it('should not show time remaining when processing completes', () => {
    const { rerender } = render(
      <BatchProgressCard
        percentage={100}
        totalRows={100}
        processedRows={100}
        estimatedTimeRemaining={5}
        status="PROCESSING"
      />
    );

    expect(screen.getByText(/Tempo estimado:/)).toBeInTheDocument();

    rerender(
      <BatchProgressCard
        percentage={100}
        totalRows={100}
        processedRows={100}
        estimatedTimeRemaining={0}
        status="COMPLETED"
      />
    );

    expect(screen.queryByText(/Tempo estimado:/)).not.toBeInTheDocument();
  });

  it('should format singular minute correctly', () => {
    render(
      <BatchProgressCard
        percentage={99}
        totalRows={100}
        processedRows={99}
        estimatedTimeRemaining={1}
        status="PROCESSING"
      />
    );

    expect(screen.getByText(/1 minuto/)).toBeInTheDocument();
    expect(screen.queryByText(/minutos/)).not.toBeInTheDocument();
  });

  it('should show queued status with default colors', () => {
    const { container } = render(
      <BatchProgressCard
        percentage={0}
        totalRows={100}
        processedRows={0}
        estimatedTimeRemaining={0}
        status="QUEUED"
      />
    );

    expect(screen.getByText('0 de 100 processados')).toBeInTheDocument();
    expect(container.querySelector('.bg-blue-500')).toBeInTheDocument();
  });

  it('should show paused status with default colors', () => {
    render(
      <BatchProgressCard
        percentage={50}
        totalRows={100}
        processedRows={50}
        estimatedTimeRemaining={0}
        status="PAUSED"
      />
    );

    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('should handle zero total rows gracefully', () => {
    render(
      <BatchProgressCard
        percentage={0}
        totalRows={0}
        processedRows={0}
        estimatedTimeRemaining={0}
        status="QUEUED"
      />
    );

    expect(screen.getByText('0 de 0 processados')).toBeInTheDocument();
  });

  it('should update when percentage changes', () => {
    const { rerender } = render(
      <BatchProgressCard
        percentage={25}
        totalRows={100}
        processedRows={25}
        estimatedTimeRemaining={15}
        status="PROCESSING"
      />
    );

    expect(screen.getByText('25%')).toBeInTheDocument();

    rerender(
      <BatchProgressCard
        percentage={75}
        totalRows={100}
        processedRows={75}
        estimatedTimeRemaining={5}
        status="PROCESSING"
      />
    );

    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText(/5 minutos/)).toBeInTheDocument();
  });
});

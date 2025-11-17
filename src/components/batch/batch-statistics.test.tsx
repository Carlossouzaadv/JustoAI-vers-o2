// ================================================================
// BATCH STATISTICS - TESTS
// ================================================================

import { render, screen } from '@testing-library/react';
import { BatchStatistics } from './batch-statistics';

describe('BatchStatistics', () => {
  it('should render all four statistics cards', () => {
    render(
      <BatchStatistics
        totalProcesses={1000}
        successfulProcesses={800}
        failedProcesses={200}
        successRate={80}
      />
    );

    expect(screen.getByText('Total de Processos')).toBeInTheDocument();
    expect(screen.getByText('Processados com Sucesso')).toBeInTheDocument();
    expect(screen.getByText('Com Erro')).toBeInTheDocument();
    expect(screen.getByText('Taxa de Sucesso')).toBeInTheDocument();
  });

  it('should display correct total processes count', () => {
    render(
      <BatchStatistics
        totalProcesses={5000}
        successfulProcesses={4500}
        failedProcesses={500}
        successRate={90}
      />
    );

    expect(screen.getByText('5000')).toBeInTheDocument();
  });

  it('should display correct successful processes count with green color', () => {
    const { container } = render(
      <BatchStatistics
        totalProcesses={1000}
        successfulProcesses={850}
        failedProcesses={150}
        successRate={85}
      />
    );

    expect(screen.getByText('850')).toBeInTheDocument();
    const greenElement = container.querySelector('.text-green-600');
    expect(greenElement).toBeInTheDocument();
    expect(greenElement).toHaveTextContent('850');
  });

  it('should display correct failed processes count with red color', () => {
    const { container } = render(
      <BatchStatistics
        totalProcesses={1000}
        successfulProcesses={900}
        failedProcesses={100}
        successRate={90}
      />
    );

    expect(screen.getByText('100')).toBeInTheDocument();
    const redElement = container.querySelector('.text-red-600');
    expect(redElement).toBeInTheDocument();
    expect(redElement).toHaveTextContent('100');
  });

  it('should display success rate with percentage symbol', () => {
    render(
      <BatchStatistics
        totalProcesses={1000}
        successfulProcesses={750}
        failedProcesses={250}
        successRate={75}
      />
    );

    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('should handle zero statistics', () => {
    render(
      <BatchStatistics
        totalProcesses={0}
        successfulProcesses={0}
        failedProcesses={0}
        successRate={0}
      />
    );

    // Find all elements with these numbers
    const zeroElements = screen.getAllByText('0');
    expect(zeroElements.length).toBeGreaterThan(0);
  });

  it('should handle 100% success rate', () => {
    render(
      <BatchStatistics
        totalProcesses={1000}
        successfulProcesses={1000}
        failedProcesses={0}
        successRate={100}
      />
    );

    expect(screen.getByText('100%')).toBeInTheDocument();
    const thousandElements = screen.getAllByText('1000');
    expect(thousandElements.length).toBeGreaterThan(0);
  });

  it('should update when props change', () => {
    const { rerender } = render(
      <BatchStatistics
        totalProcesses={100}
        successfulProcesses={80}
        failedProcesses={20}
        successRate={80}
      />
    );

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();

    rerender(
      <BatchStatistics
        totalProcesses={200}
        successfulProcesses={150}
        failedProcesses={50}
        successRate={75}
      />
    );

    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('should arrange cards in responsive grid', () => {
    const { container } = render(
      <BatchStatistics
        totalProcesses={1000}
        successfulProcesses={800}
        failedProcesses={200}
        successRate={80}
      />
    );

    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveClass('grid-cols-1');
    expect(grid).toHaveClass('md:grid-cols-4');
  });

  it('should render icon containers for each stat', () => {
    const { container } = render(
      <BatchStatistics
        totalProcesses={1000}
        successfulProcesses={800}
        failedProcesses={200}
        successRate={80}
      />
    );

    const iconContainers = container.querySelectorAll('[class*="bg-"][class*="-100"]');
    expect(iconContainers.length).toBeGreaterThan(0);
  });

  it('should handle large numbers', () => {
    render(
      <BatchStatistics
        totalProcesses={1000000}
        successfulProcesses={950000}
        failedProcesses={50000}
        successRate={95}
      />
    );

    expect(screen.getByText('1000000')).toBeInTheDocument();
    expect(screen.getByText('950000')).toBeInTheDocument();
    expect(screen.getByText('50000')).toBeInTheDocument();
  });
});

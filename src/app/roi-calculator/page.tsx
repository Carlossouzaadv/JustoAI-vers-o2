import { Metadata } from 'next';
import { ROICalculator } from '@/components/roi-calculator/roi-calculator';

export const metadata: Metadata = {
  title: 'Calculadora de ROI | JustoAI',
  description: 'Calcule quanto tempo e dinheiro você pode economizar automatizando relatórios executivos com JustoAI',
};

export default function ROICalculatorPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <ROICalculator />
      </div>
    </div>
  );
}

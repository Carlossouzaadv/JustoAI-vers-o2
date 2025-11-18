/**
 * ROI Calculator for JustoAI
 * Calculates savings and ROI for law firms using JustoAI
 */

export interface ROIInputs {
  hoursPerWeek: number; // Hours spent on executive reports per week
  hourlyRate: number; // Lawyer's hourly rate in BRL
  numClients: number; // Number of active clients
  reportFrequency: 'weekly' | 'biweekly' | 'monthly'; // Report frequency per client
  selectedPlan: 'gestao' | 'performance'; // Selected plan
}

export interface ROICalculation {
  // Current state (without JustoAI)
  currentMonthlyHours: number;
  currentMonthlyCost: number; // In BRL

  // With JustoAI
  savedMonthlyHours: number;
  savedMonthlyCostBRL: number; // In BRL
  planMonthlyCostBRL: number; // In BRL
  netMonthlySavingsBRL: number; // Savings minus plan cost

  // ROI metrics
  roiPercentage: number; // ROI as percentage
  paybackPeriodDays: number; // Days to break even
  annualSavingsBRL: number; // Annual savings (minus plan cost)

  // Time metrics
  annualHoursSaved: number;
  annualHoursFreed: string; // Human readable (e.g., "520 hours / 13 weeks")
}

const PLAN_COSTS = {
  gestao: 497, // R$ per month
  performance: 1197 // R$ per month
};

const REPORTS_PER_WEEK = {
  weekly: 1,
  biweekly: 0.5,
  monthly: 0.25
};

/**
 * Calculate how many reports per month
 */
function calculateReportsPerMonth(numClients: number, frequency: 'weekly' | 'biweekly' | 'monthly'): number {
  const reportsPerWeek = numClients * REPORTS_PER_WEEK[frequency];
  return reportsPerWeek * 4.33; // Average weeks per month
}

/**
 * Estimate hours saved per report (average)
 * Based on typical lawyer workflow: 1-2 hours per executive report
 */
function estimateHoursPerReport(): number {
  return 1.5; // Conservative estimate
}

/**
 * Calculate complete ROI metrics
 */
export function calculateROI(inputs: ROIInputs): ROICalculation {
  const {
    hoursPerWeek,
    hourlyRate,
    numClients,
    reportFrequency,
    selectedPlan
  } = inputs;

  // Calculate current situation (without JustoAI)
  const currentMonthlyHours = hoursPerWeek * 4.33; // Average weeks per month
  const currentMonthlyCost = currentMonthlyHours * hourlyRate;

  // Calculate monthly reports
  const reportsPerMonth = calculateReportsPerMonth(numClients, reportFrequency);
  const hoursPerReport = estimateHoursPerReport();

  // Calculate time saved with JustoAI (assumes 80% time reduction)
  const savedMonthlyHours = reportsPerMonth * hoursPerReport * 0.8;
  const savedMonthlyCostBRL = savedMonthlyHours * hourlyRate;

  // Plan cost
  const planMonthlyCostBRL = PLAN_COSTS[selectedPlan];

  // Net savings
  const netMonthlySavingsBRL = savedMonthlyCostBRL - planMonthlyCostBRL;

  // ROI calculation
  const roiPercentage = (netMonthlySavingsBRL / planMonthlyCostBRL) * 100;
  const paybackPeriodDays = planMonthlyCostBRL > 0 ? Math.ceil((planMonthlyCostBRL / savedMonthlyCostBRL) * 30) : 0;

  // Annual metrics
  const annualSavingsBRL = netMonthlySavingsBRL * 12;
  const annualHoursSaved = savedMonthlyHours * 12;
  const annualWeeksSaved = annualHoursSaved / 40; // Assuming 40-hour work week

  const annualHoursFreed = `${Math.round(annualHoursSaved)} hours / ${Math.round(annualWeeksSaved)} weeks`;

  return {
    currentMonthlyHours: Math.round(currentMonthlyHours * 10) / 10,
    currentMonthlyCost: Math.round(currentMonthlyCost),
    savedMonthlyHours: Math.round(savedMonthlyHours * 10) / 10,
    savedMonthlyCostBRL: Math.round(savedMonthlyCostBRL),
    planMonthlyCostBRL,
    netMonthlySavingsBRL: Math.round(netMonthlySavingsBRL),
    roiPercentage: Math.round(roiPercentage),
    paybackPeriodDays: Math.max(1, paybackPeriodDays),
    annualSavingsBRL: Math.round(annualSavingsBRL),
    annualHoursSaved: Math.round(annualHoursSaved),
    annualHoursFreed
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/**
 * Get ROI sentiment (positive/neutral/negative)
 */
export function getROISentiment(roiPercentage: number): 'positive' | 'neutral' | 'negative' {
  if (roiPercentage >= 100) return 'positive';
  if (roiPercentage >= 0) return 'neutral';
  return 'negative';
}

/**
 * Get ROI message based on percentage
 */
export function getROIMessage(roiPercentage: number): string {
  if (roiPercentage >= 200) {
    return 'Extraordinário! Seu retorno é maior que 200%';
  }
  if (roiPercentage >= 100) {
    return 'Excelente! Seu investimento se paga em 1-2 meses';
  }
  if (roiPercentage >= 0) {
    return 'Positivo! Você recupera o investimento em alguns meses';
  }
  if (roiPercentage >= -50) {
    return 'Ainda assim economiza tempo valioso';
  }
  return 'Considere o valor do tempo economizado';
}

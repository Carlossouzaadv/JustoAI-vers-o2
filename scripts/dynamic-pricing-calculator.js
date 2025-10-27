#!/usr/bin/env node

/**
 * Dynamic Pricing Calculator
 * Calcula pricing, ROI e projeções baseado em inputs do usuário
 *
 * Uso: node dynamic-pricing-calculator.js
 */

const readline = require('readline');

// Dados base do consumo
const BASE_COST_PER_REQUEST = 0.57;

const PLANS = {
  A: {
    name: 'Starter',
    costPerMonth: 148.91,
    requisicoesPerMonth: 260,
  },
  B: {
    name: 'Professional',
    costPerMonth: 446.73,
    requisicoesPerMonth: 780,
  },
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

function formatCurrency(value) {
  return `R$ ${value.toFixed(2)}`;
}

// ============================================================
// CALCULADORAS
// ============================================================

function calculateMonthlyProfit(costPerMonth, monthlyPrice) {
  return monthlyPrice - costPerMonth;
}

function calculateMarginFromPrice(costPerMonth, monthlyPrice) {
  if (monthlyPrice <= costPerMonth) return 0;
  const profit = monthlyPrice - costPerMonth;
  return (profit / monthlyPrice) * 100;
}

function calculatePriceFromMargin(costPerMonth, marginPercentage) {
  const costMargin = marginPercentage / 100;
  return costPerMonth / (1 - costMargin);
}

function calculateProjection(plan, monthlyPrice, numClients, months) {
  const monthlyProfit = calculateMonthlyProfit(plan.costPerMonth, monthlyPrice);
  const totalMonthlyRevenue = monthlyPrice * numClients;
  const totalMonthlyCost = plan.costPerMonth * numClients;
  const totalMonthlyProfit = monthlyProfit * numClients;

  const projectionMonths = {
    totalRevenue: totalMonthlyRevenue * months,
    totalCost: totalMonthlyCost * months,
    totalProfit: totalMonthlyProfit * months,
    avgMonthlyProfit: totalMonthlyProfit,
  };

  return {
    monthly: {
      revenue: totalMonthlyRevenue,
      cost: totalMonthlyCost,
      profit: totalMonthlyProfit,
      profitPerClient: monthlyProfit,
    },
    projection: projectionMonths,
  };
}

function calculateLTV(monthlyProfit, years) {
  return monthlyProfit * 12 * years;
}

function calculateCAC(monthlyProfit, months) {
  return monthlyProfit * months;
}

// ============================================================
// MENUS
// ============================================================

async function mainMenu() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('      💰 DYNAMIC PRICING CALCULATOR - JustoAI');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const options = [
    '1. Calcular preço por margem desejada',
    '2. Calcular margem de um preço específico',
    '3. Projetar receita (X clientes, Y meses)',
    '4. Calcular LTV e CAC',
    '5. Comparar cenários (Plano A vs B)',
    '6. Ver dados base',
    '7. Sair',
  ];

  options.forEach((opt) => console.log(`  ${opt}`));

  const choice = await question('\nEscolha uma opção (1-7): ');
  return choice;
}

// ============================================================
// CALCULADORA 1: Preço por Margem
// ============================================================

async function calculateByMargin() {
  console.log('\n┌─ CALCULAR PREÇO POR MARGEM ────────────────────────────');
  console.log('│ Qual margem de lucro você deseja?');
  console.log('│ (Exemplo: 70 para 70% de margem)');
  console.log('└──────────────────────────────────────────────────────\n');

  const margin = parseFloat(await question('Margem desejada (%): '));
  const planChoice = await question('Qual plano? (A/B): ');

  if (!['A', 'B'].includes(planChoice.toUpperCase())) {
    console.log('❌ Plano inválido!');
    return;
  }

  const plan = PLANS[planChoice.toUpperCase()];
  const price = calculatePriceFromMargin(plan.costPerMonth, margin);
  const profit = calculateMonthlyProfit(plan.costPerMonth, price);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  RESULTADO');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n Plano: ${plan.name}`);
  console.log(`ℹ️  Custo Operacional: ${formatCurrency(plan.costPerMonth)}/mês`);
  console.log(`\n💰 Com ${margin}% de Margem:`);
  console.log(`   Preço Mensal: ${formatCurrency(price)}`);
  console.log(`   Lucro/Mês: ${formatCurrency(profit)}`);
  console.log(`   Lucro/Ano: ${formatCurrency(profit * 12)}`);
  console.log(`\n📊 Métricas:`);
  console.log(`   LTV (3 anos): ${formatCurrency(calculateLTV(profit, 3))}`);
  console.log(`   CAC Break-even (com CAC R$500): ${(500 / profit).toFixed(1)} meses`);
  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

// ============================================================
// CALCULADORA 2: Margem de um Preço
// ============================================================

async function calculateByPrice() {
  console.log('\n┌─ CALCULAR MARGEM DE UM PREÇO ──────────────────────────');
  console.log('│ Você quer cobrar quanto por mês?');
  console.log('│ (Exemplo: 1000 para R$ 1.000)');
  console.log('└──────────────────────────────────────────────────────\n');

  const price = parseFloat(await question('Preço mensal (R$): '));
  const planChoice = await question('Qual plano? (A/B): ');

  if (!['A', 'B'].includes(planChoice.toUpperCase())) {
    console.log('❌ Plano inválido!');
    return;
  }

  const plan = PLANS[planChoice.toUpperCase()];
  const profit = calculateMonthlyProfit(plan.costPerMonth, price);
  const margin = calculateMarginFromPrice(plan.costPerMonth, price);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  RESULTADO');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n Plano: ${plan.name}`);
  console.log(`ℹ️  Custo Operacional: ${formatCurrency(plan.costPerMonth)}/mês`);
  console.log(`\n💰 Com Preço de ${formatCurrency(price)}:`);
  console.log(`   Margem: ${margin.toFixed(1)}%`);
  console.log(`   Lucro/Mês: ${formatCurrency(profit)}`);
  console.log(`   Lucro/Ano: ${formatCurrency(profit * 12)}`);

  if (profit < 0) {
    console.log('\n⚠️  AVISO: Preço está abaixo do custo!');
  }

  console.log(`\n📊 Métricas:`);
  console.log(`   LTV (3 anos): ${formatCurrency(calculateLTV(profit, 3))}`);
  if (profit > 0) {
    console.log(`   CAC Break-even (com CAC R$500): ${(500 / profit).toFixed(1)} meses`);
  }
  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

// ============================================================
// CALCULADORA 3: Projeção
// ============================================================

async function projectRevenue() {
  console.log('\n┌─ PROJETAR RECEITA ─────────────────────────────────────');
  console.log('│ Quantos clientes você quer ter?');
  console.log('└──────────────────────────────────────────────────────\n');

  const numClients = parseInt(await question('Número de clientes: '));

  console.log('\nQual é a distribuição de planos?');
  const clientsA = parseInt(await question('Clientes no Plano A: '));
  const clientsB = numClients - clientsA;

  console.log(`\nEm quantos meses você quer projetar? (1-36): `);
  const months = parseInt(await question('Número de meses: '));

  console.log(`\nQual é o preço mensal do Plano A? (${formatCurrency(calculatePriceFromMargin(PLANS.A.costPerMonth, 70))} = 70% margem)`);
  const priceA = parseFloat(await question('Preço Plano A (R$): '));

  console.log(`\nQual é o preço mensal do Plano B? (${formatCurrency(calculatePriceFromMargin(PLANS.B.costPerMonth, 70))} = 70% margem)`);
  const priceB = parseFloat(await question('Preço Plano B (R$): '));

  const projA = calculateProjection(PLANS.A, priceA, clientsA, months);
  const projB = calculateProjection(PLANS.B, priceB, clientsB, months);

  const totalMonthlyRevenue = projA.monthly.revenue + projB.monthly.revenue;
  const totalMonthlyProfit = projA.monthly.profit + projB.monthly.profit;
  const totalProjectionProfit = projA.projection.totalProfit + projB.projection.totalProfit;

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PROJEÇÃO DE RECEITA');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n📊 Composição:`);
  console.log(`   Plano A: ${clientsA} clientes × ${formatCurrency(priceA)}/mês`);
  console.log(`   Plano B: ${clientsB} clientes × ${formatCurrency(priceB)}/mês`);

  console.log(`\n💰 Mensalmente (estado estável):`);
  console.log(`   Receita Total: ${formatCurrency(totalMonthlyRevenue)}`);
  console.log(`   Custo Total: ${formatCurrency(projA.monthly.cost + projB.monthly.cost)}`);
  console.log(`   Lucro Total: ${formatCurrency(totalMonthlyProfit)}`);

  console.log(`\n📈 Projeção ${months}-meses:`);
  console.log(`   Receita Total: ${formatCurrency(projA.projection.totalRevenue + projB.projection.totalRevenue)}`);
  console.log(`   Custo Total: ${formatCurrency(projA.projection.totalCost + projB.projection.totalCost)}`);
  console.log(`   Lucro Total: ${formatCurrency(totalProjectionProfit)}`);

  const margin = (totalProjectionProfit / (projA.projection.totalRevenue + projB.projection.totalRevenue)) * 100;
  console.log(`   Margem Média: ${margin.toFixed(1)}%`);

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

// ============================================================
// CALCULADORA 4: LTV e CAC
// ============================================================

async function calculateLTVandCAC() {
  console.log('\n┌─ CALCULAR LTV E CAC ────────────────────────────────────');
  console.log('│ LTV = Lifetime Value (quanto cliente rende em 3 anos)');
  console.log('│ CAC = Customer Acquisition Cost (quanto custa adquirir)');
  console.log('└──────────────────────────────────────────────────────\n');

  const planChoice = await question('Qual plano? (A/B): ');
  if (!['A', 'B'].includes(planChoice.toUpperCase())) {
    console.log('❌ Plano inválido!');
    return;
  }

  const plan = PLANS[planChoice.toUpperCase()];

  console.log(`\nQual é o preço mensal do Plano ${planChoice.toUpperCase()}? (${formatCurrency(calculatePriceFromMargin(plan.costPerMonth, 70))} = 70% margem)`);
  const price = parseFloat(await question('Preço mensal (R$): '));

  const profit = calculateMonthlyProfit(plan.costPerMonth, price);

  const ltv1year = calculateLTV(profit, 1);
  const ltv3years = calculateLTV(profit, 3);
  const ltv5years = calculateLTV(profit, 5);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  LIFETIME VALUE (LTV)');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\n📊 Lucro Mensal: ${formatCurrency(profit)}`);
  console.log(`\n💰 Lifetime Value:`);
  console.log(`   1 ano:  ${formatCurrency(ltv1year)}`);
  console.log(`   3 anos: ${formatCurrency(ltv3years)}`);
  console.log(`   5 anos: ${formatCurrency(ltv5years)}`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  CUSTOMER ACQUISITION COST (CAC) - Break-even');
  console.log('═══════════════════════════════════════════════════════════════');

  const cac100 = calculateCAC(profit, 1);
  const cac500 = calculateCAC(profit, 5);
  const cac1000 = calculateCAC(profit, 10);

  console.log(`\n🎯 Se você gasta em CAC, recupera em:`);
  console.log(`   ${formatCurrency(cac100)}: 1 mês`);
  console.log(`   ${formatCurrency(cac500)}: 5 meses`);
  console.log(`   ${formatCurrency(cac1000)}: 10 meses`);

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

// ============================================================
// CALCULADORA 5: Comparar Cenários
// ============================================================

async function compareScenarios() {
  console.log('\n┌─ COMPARAR CENÁRIOS ────────────────────────────────────');
  console.log('│ Qual é o seu preço para cada plano?');
  console.log('└──────────────────────────────────────────────────────\n');

  const priceA = parseFloat(await question(`Preço Plano A/mês (${formatCurrency(calculatePriceFromMargin(PLANS.A.costPerMonth, 70))} = 70%): `));
  const priceB = parseFloat(await question(`Preço Plano B/mês (${formatCurrency(calculatePriceFromMargin(PLANS.B.costPerMonth, 70))} = 70%): `));

  console.log('\nAgora, qual é o mix de clientes esperado?');
  const totalClients = parseInt(await question('Total de clientes: '));
  const clientsA = parseInt(await question('Clientes Plano A: '));
  const clientsB = totalClients - clientsA;

  const profitA = calculateMonthlyProfit(PLANS.A.costPerMonth, priceA);
  const profitB = calculateMonthlyProfit(PLANS.B.costPerMonth, priceB);
  const revenueA = priceA * clientsA;
  const revenueB = priceB * clientsB;

  const totalMonthly = profitA * clientsA + profitB * clientsB;
  const totalRevenue = revenueA + revenueB;

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  COMPARAÇÃO DE CENÁRIOS');
  console.log('═══════════════════════════════════════════════════════════════');

  console.log(`\n🔵 PLANO A: ${clientsA} clientes`);
  console.log(`   Preço: ${formatCurrency(priceA)}/mês`);
  console.log(`   Lucro/cliente: ${formatCurrency(profitA)}`);
  console.log(`   Lucro Total (Plano A): ${formatCurrency(profitA * clientsA)}`);

  console.log(`\n🟣 PLANO B: ${clientsB} clientes`);
  console.log(`   Preço: ${formatCurrency(priceB)}/mês`);
  console.log(`   Lucro/cliente: ${formatCurrency(profitB)}`);
  console.log(`   Lucro Total (Plano B): ${formatCurrency(profitB * clientsB)}`);

  console.log(`\n📊 CONSOLIDADO:`);
  console.log(`   Clientes Totais: ${totalClients}`);
  console.log(`   Receita Mensal: ${formatCurrency(totalRevenue)}`);
  console.log(`   Lucro Mensal: ${formatCurrency(totalMonthly)}`);
  console.log(`   Lucro Anual: ${formatCurrency(totalMonthly * 12)}`);

  const margin = (totalMonthly / totalRevenue) * 100;
  console.log(`   Margem Média: ${margin.toFixed(1)}%`);

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

// ============================================================
// MOSTRAR DADOS BASE
// ============================================================

async function showBasicData() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  DADOS BASE (De Consumo Real JUDIT)');
  console.log('═══════════════════════════════════════════════════════════════');

  console.log(`\n💵 PLANO A (Starter)`);
  console.log(`   Custo Operacional/mês: ${formatCurrency(PLANS.A.costPerMonth)}`);
  console.log(`   Requisições JUDIT/mês: ${PLANS.A.requisicoesPerMonth}`);

  console.log(`\n💵 PLANO B (Professional)`);
  console.log(`   Custo Operacional/mês: ${formatCurrency(PLANS.B.costPerMonth)}`);
  console.log(`   Requisições JUDIT/mês: ${PLANS.B.requisicoesPerMonth}`);

  console.log(`\n📊 PRICING SUGERIDO (70% margem)`);
  const priceA70 = calculatePriceFromMargin(PLANS.A.costPerMonth, 70);
  const priceB70 = calculatePriceFromMargin(PLANS.B.costPerMonth, 70);
  console.log(`   Plano A: ${formatCurrency(priceA70)}/mês`);
  console.log(`   Plano B: ${formatCurrency(priceB70)}/mês`);

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

// ============================================================
// MAIN LOOP
// ============================================================

async function main() {
  let running = true;

  while (running) {
    const choice = await mainMenu();

    switch (choice) {
      case '1':
        await calculateByMargin();
        break;
      case '2':
        await calculateByPrice();
        break;
      case '3':
        await projectRevenue();
        break;
      case '4':
        await calculateLTVandCAC();
        break;
      case '5':
        await compareScenarios();
        break;
      case '6':
        await showBasicData();
        break;
      case '7':
        console.log('\n👋 Até logo!\n');
        running = false;
        break;
      default:
        console.log('\n❌ Opção inválida. Tente novamente.\n');
    }
  }

  rl.close();
}

main();

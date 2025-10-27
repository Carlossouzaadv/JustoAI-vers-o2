#!/usr/bin/env node

/**
 * JUDIT API Consumption Report Generator
 * Generates a detailed consumption report for the JUDIT API
 * Usage: node judit-consumption-report.js
 */

const apiKey = '4b851ddf-83f1-4f68-8f82-54af336b3d52';
const startDate = '2025-10-17';
const endDate = '2025-10-27';

// Pricing table (estimated values)
const pricing = {
  searches: {
    cpf: 0.50,
    cnpj: 0.50,
    oab: 0.50,
    name: 0.50,
    lawsuit_cnj: 0.30,
  },
  attachments: 3.50,
  monitoring: {
    cpf: 0.69,
    cnpj: 0.69,
    oab: 0.69,
    name: 0.69,
    lawsuit_cnj: 0.69,
  },
};

async function fetchJuditRequests() {
  const url = `https://requests.prod.judit.io/requests?page_size=1000&created_at_gte=${startDate}&created_at_lte=${endDate}`;

  try {
    console.log('🔄 Fetching JUDIT requests...\n');
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'api-key': apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.page_data || [];
  } catch (error) {
    console.error('❌ Error fetching JUDIT data:', error.message);
    process.exit(1);
  }
}

function calculateCost(request) {
  let cost = 0;
  const search = request.search || {};
  const searchType = search.search_type || 'unknown';
  const origin = request.origin || 'unknown';
  const hasAttachments = request.with_attachments === true;

  // Base search cost
  if (origin === 'api') {
    cost += pricing.searches[searchType] || 0.30;
  } else if (origin === 'tracking') {
    cost += pricing.monitoring[searchType] || 0.69;
  }

  // Attachment cost
  if (hasAttachments) {
    cost += pricing.attachments;
  }

  return cost;
}

function analyzeRequests(requests) {
  const analysis = {
    total: requests.length,
    byOrigin: {},
    bySearchType: {},
    byResponseType: {},
    withAttachments: 0,
    byStatus: {},
    totalEstimatedCost: 0,
    requests: [],
  };

  requests.forEach((req) => {
    const origin = req.origin || 'unknown';
    const searchType = req.search?.search_type || 'unknown';
    const responseType = req.search?.response_type || 'unknown';
    const status = req.status || 'unknown';
    const cost = calculateCost(req);

    // Count by origin
    analysis.byOrigin[origin] = (analysis.byOrigin[origin] || 0) + 1;

    // Count by search type
    analysis.bySearchType[searchType] = (analysis.bySearchType[searchType] || 0) + 1;

    // Count by response type
    analysis.byResponseType[responseType] = (analysis.byResponseType[responseType] || 0) + 1;

    // Count with attachments
    if (req.with_attachments) {
      analysis.withAttachments += 1;
    }

    // Count by status
    analysis.byStatus[status] = (analysis.byStatus[status] || 0) + 1;

    // Total cost
    analysis.totalEstimatedCost += cost;

    // Store request details
    analysis.requests.push({
      id: req.request_id,
      searchType,
      responseType,
      origin,
      hasAttachments: req.with_attachments,
      status,
      createdAt: req.created_at,
      cost,
    });
  });

  return analysis;
}

function formatCurrency(value) {
  return `R$ ${value.toFixed(2)}`;
}

function generateReport(analysis) {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('          📊 JUDIT API CONSUMPTION REPORT');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`\nPeriod: ${startDate} to ${endDate}`);
  console.log(`Report Generated: ${new Date().toLocaleString('pt-BR')}`);

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('📈 SUMMARY');
  console.log('───────────────────────────────────────────────────────────────');
  console.log(`Total Requests:        ${analysis.total}`);
  console.log(`Requests with Attachments: ${analysis.withAttachments}`);
  console.log(`Estimated Total Cost:  ${formatCurrency(analysis.totalEstimatedCost)}`);
  console.log(`Average Cost per Request: ${formatCurrency(analysis.totalEstimatedCost / analysis.total)}`);

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('🔍 BY ORIGIN');
  console.log('───────────────────────────────────────────────────────────────');
  Object.entries(analysis.byOrigin)
    .sort((a, b) => b[1] - a[1])
    .forEach(([origin, count]) => {
      const percentage = ((count / analysis.total) * 100).toFixed(1);
      const originLabel = origin.toUpperCase().padEnd(15);
      const countLabel = count.toString().padStart(4);
      console.log(`  ${originLabel} ${countLabel} (${percentage}%)`);
    });

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('🔎 BY SEARCH TYPE');
  console.log('───────────────────────────────────────────────────────────────');
  Object.entries(analysis.bySearchType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      const percentage = ((count / analysis.total) * 100).toFixed(1);
      const typeLabel = type.toUpperCase().padEnd(20);
      const countLabel = count.toString().padStart(4);
      console.log(`  ${typeLabel} ${countLabel} (${percentage}%)`);
    });

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('📄 BY RESPONSE TYPE');
  console.log('───────────────────────────────────────────────────────────────');
  Object.entries(analysis.byResponseType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      const percentage = ((count / analysis.total) * 100).toFixed(1);
      const typeLabel = type.toUpperCase().padEnd(20);
      const countLabel = count.toString().padStart(4);
      console.log(`  ${typeLabel} ${countLabel} (${percentage}%)`);
    });

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('✅ BY STATUS');
  console.log('───────────────────────────────────────────────────────────────');
  Object.entries(analysis.byStatus)
    .sort((a, b) => b[1] - a[1])
    .forEach(([status, count]) => {
      const percentage = ((count / analysis.total) * 100).toFixed(1);
      const statusLabel = status.toUpperCase().padEnd(20);
      const countLabel = count.toString().padStart(4);
      console.log(`  ${statusLabel} ${countLabel} (${percentage}%)`);
    });

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('💰 COST BREAKDOWN');
  console.log('───────────────────────────────────────────────────────────────');

  // API vs Tracking costs
  let apiCost = 0;
  let trackingCost = 0;
  let attachmentCost = 0;

  analysis.requests.forEach((req) => {
    const baseCost = req.origin === 'api' ? (pricing.searches[req.searchType] || 0.30) : (pricing.monitoring[req.searchType] || 0.69);
    if (req.origin === 'api') {
      apiCost += baseCost;
    } else if (req.origin === 'tracking') {
      trackingCost += baseCost;
    }
    if (req.hasAttachments) {
      attachmentCost += pricing.attachments;
    }
  });

  console.log(`  API Requests:        ${formatCurrency(apiCost)}`);
  console.log(`  Tracking Requests:   ${formatCurrency(trackingCost)}`);
  console.log(`  Attachments:         ${formatCurrency(attachmentCost)}`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  TOTAL:               ${formatCurrency(analysis.totalEstimatedCost)}`);

  console.log('\n───────────────────────────────────────────────────────────────');
  console.log('📋 REQUESTS DETAIL');
  console.log('───────────────────────────────────────────────────────────────');

  analysis.requests
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach((req, index) => {
      const date = new Date(req.createdAt).toLocaleString('pt-BR');
      const attachmentLabel = req.hasAttachments ? '📎' : '  ';
      console.log(
        `${(index + 1).toString().padStart(3)}. [${date}] ${attachmentLabel} ${req.searchType} → ${req.responseType} (${req.origin}) | ${formatCurrency(req.cost)}`
      );
    });

  console.log('\n═══════════════════════════════════════════════════════════════\n');
}

async function main() {
  try {
    const requests = await fetchJuditRequests();

    if (requests.length === 0) {
      console.log('⚠️  No requests found in the specified period.');
      return;
    }

    const analysis = analyzeRequests(requests);
    generateReport(analysis);

    // Export to JSON for further analysis
    const reportPath = `./judit-report-${new Date().toISOString().split('T')[0]}.json`;
    const fs = require('fs');
    fs.writeFileSync(reportPath, JSON.stringify(analysis, null, 2));
    console.log(`✅ Full report exported to: ${reportPath}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

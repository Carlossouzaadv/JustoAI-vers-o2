#!/usr/bin/env node

/**
 * Sync Knowledge Base to Crisp
 *
 * This script automatically extracts help content and syncs it to Crisp's
 * knowledge base via the Crisp API. This enables the AI bot to answer
 * questions based on your help documentation.
 *
 * Prerequisites:
 *   1. Set CRISP_API_TOKEN in .env.local
 *   2. Set CRISP_WEBSITE_ID in .env.local
 *   3. Set CRISP_ACCOUNT_ID in .env.local
 *
 * Usage:
 *   npm run sync-crisp-kb
 *
 * Note: First run may take a few minutes. Subsequent runs are incremental.
 */

require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');

const HELP_DIR = path.join(__dirname, '../src/app/help');
const API_BASE = 'https://api.crisp.chat/v1';

// Crisp API credentials
const CRISP_API_TOKEN = process.env.CRISP_API_TOKEN;
const CRISP_WEBSITE_ID = process.env.CRISP_WEBSITE_ID || '7acdaf6a-3b6a-4089-bd4e-d611e6362313';
const CRISP_ACCOUNT_ID = process.env.CRISP_ACCOUNT_ID;

// Validate credentials
if (!CRISP_API_TOKEN || !CRISP_WEBSITE_ID || !CRISP_ACCOUNT_ID) {
  console.error('❌ Missing Crisp API credentials\n');
  console.error('Required environment variables:');
  console.error('  - CRISP_API_TOKEN');
  console.error('  - CRISP_WEBSITE_ID');
  console.error('  - CRISP_ACCOUNT_ID\n');
  console.error('Add these to .env.local and try again.\n');
  process.exit(1);
}

/**
 * Extract content from help articles (same as extract-help-content.js)
 */
function extractArticleContent(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    const titleMatch = content.match(/title="([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : 'Untitled';

    const categoryMatch = content.match(/category="([^"]+)"/);
    const category = categoryMatch ? categoryMatch[1] : 'General';

    const readTimeMatch = content.match(/readTime="([^"]+)"/);
    const readTime = readTimeMatch ? readTimeMatch[1] : 'Unknown';

    const layoutStartMatch = content.match(/<HelpArticleLayout[^>]*>/);
    const layoutEndMatch = content.match(/<\/HelpArticleLayout>/);

    if (!layoutStartMatch || !layoutEndMatch) {
      return null;
    }

    const layoutStart = layoutStartMatch.index + layoutStartMatch[0].length;
    const layoutEnd = layoutEndMatch.index;
    const jsxContent = content.substring(layoutStart, layoutEnd);

    const plainText = convertJSXToPlainText(jsxContent);

    return {
      title,
      category,
      readTime,
      content: plainText,
    };
  } catch (error) {
    console.warn(`  ⚠️  ${path.basename(filePath)}: ${error.message}`);
    return null;
  }
}

/**
 * Convert JSX to plain text/markdown
 */
function convertJSXToPlainText(jsxContent) {
  let text = jsxContent;

  text = text.replace(/\s+(className|style|onClick|onChange|[a-z]+Ref)="[^"]*"/g, '');
  text = text.replace(/\s+className=\{[^}]*\}/g, '');

  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gs, '\n## $1\n');
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gs, '\n### $1\n');
  text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gs, '\n#### $1\n');

  text = text.replace(/<p[^>]*>(.*?)<\/p>/gs, '$1\n');

  text = text.replace(/<ul[^>]*>(.*?)<\/ul>/gs, (match, content) => {
    const items = content.match(/<li[^>]*>(.*?)<\/li>/gs) || [];
    return '\n' + items.map(item => {
      const itemContent = item.replace(/<li[^>]*>(.*?)<\/li>/s, '$1');
      return '- ' + itemContent.trim();
    }).join('\n') + '\n';
  });

  text = text.replace(/<ol[^>]*>(.*?)<\/ol>/gs, (match, content) => {
    const items = content.match(/<li[^>]*>(.*?)<\/li>/gs) || [];
    return '\n' + items.map((item, index) => {
      const itemContent = item.replace(/<li[^>]*>(.*?)<\/li>/s, '$1');
      return `${index + 1}. ` + itemContent.trim();
    }).join('\n') + '\n';
  });

  text = text.replace(/<li[^>]*>(.*?)<\/li>/gs, '- $1');

  text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gs, '**$1**');
  text = text.replace(/<b[^>]*>(.*?)<\/b>/gs, '**$1**');

  text = text.replace(/<em[^>]*>(.*?)<\/em>/gs, '*$1*');
  text = text.replace(/<i[^>]*>(.*?)<\/i>/gs, '*$1*');

  text = text.replace(/<div[^>]*>(.*?)<\/div>/gs, '$1');

  text = text.replace(/<br\s*\/?>/g, '\n');

  text = text.replace(/<[^>]+>/g, '');

  text = text.replace(/\n\n\n+/g, '\n\n');

  return text.trim();
}

/**
 * Find all help articles
 */
function findHelpArticles(dir, articles = []) {
  try {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        if (!file.startsWith('.') && file !== 'node_modules') {
          findHelpArticles(filePath, articles);
        }
      } else if (file === 'page.tsx' && dir !== HELP_DIR) {
        articles.push(filePath);
      }
    }
  } catch (error) {
    // Silently skip
  }

  return articles;
}

/**
 * Make API call to Crisp
 */
async function crispApiCall(method, endpoint, data = null) {
  const url = `${API_BASE}${endpoint}`;

  const options = {
    method,
    headers: {
      'Authorization': `Basic ${Buffer.from(`${CRISP_ACCOUNT_ID}:${CRISP_API_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/json',
      'User-Agent': 'JustoAI/1.0',
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`API Error ${response.status}: ${errorData}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(`${method} ${endpoint}: ${error.message}`);
  }
}

/**
 * Get existing knowledge base documents
 */
async function getExistingDocuments() {
  try {
    const response = await crispApiCall(
      'GET',
      `/accounts/${CRISP_ACCOUNT_ID}/websites/${CRISP_WEBSITE_ID}/knowledge/documents`
    );

    return response.data || [];
  } catch (error) {
    console.warn(`⚠️  Could not fetch existing documents: ${error.message}`);
    return [];
  }
}

/**
 * Create or update a knowledge base document
 */
async function syncDocument(article, existingDocs) {
  // Check if document already exists
  const existingDoc = existingDocs.find(doc => doc.title === article.title);

  const docData = {
    title: article.title,
    content: article.content,
    sections: [
      {
        title: 'Content',
        content: article.content,
      },
    ],
  };

  try {
    if (existingDoc) {
      // Update existing document
      await crispApiCall(
        'PATCH',
        `/accounts/${CRISP_ACCOUNT_ID}/websites/${CRISP_WEBSITE_ID}/knowledge/documents/${existingDoc.document_id}`,
        docData
      );

      return { status: 'updated', title: article.title };
    } else {
      // Create new document
      await crispApiCall(
        'POST',
        `/accounts/${CRISP_ACCOUNT_ID}/websites/${CRISP_WEBSITE_ID}/knowledge/documents`,
        docData
      );

      return { status: 'created', title: article.title };
    }
  } catch (error) {
    return { status: 'error', title: article.title, error: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 JustoAI Crisp Knowledge Base Sync\n');

  console.log('📝 Configuration:');
  console.log(`  Website ID: ${CRISP_WEBSITE_ID}`);
  console.log(`  Account ID: ${CRISP_ACCOUNT_ID}\n`);

  // Step 1: Extract help articles
  console.log('📄 Extracting help articles...');
  const articlePaths = findHelpArticles(HELP_DIR);
  console.log(`  ✓ Found ${articlePaths.length} articles\n`);

  console.log('🔄 Extracting content...');
  const articles = articlePaths
    .map(filePath => extractArticleContent(filePath))
    .filter(article => article !== null);

  console.log(`  ✓ Extracted ${articles.length} articles\n`);

  // Step 2: Fetch existing documents
  console.log('📊 Checking existing documents...');
  const existingDocs = await getExistingDocuments();
  console.log(`  ✓ Found ${existingDocs.length} existing documents\n`);

  // Step 3: Sync documents
  console.log('🔄 Syncing to Crisp...\n');

  const results = {
    created: [],
    updated: [],
    errors: [],
  };

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const progress = `[${i + 1}/${articles.length}]`;

    process.stdout.write(`  ${progress} Syncing "${article.title}"... `);

    const result = await syncDocument(article, existingDocs);

    if (result.status === 'created') {
      console.log('✅ Created');
      results.created.push(result.title);
    } else if (result.status === 'updated') {
      console.log('🔄 Updated');
      results.updated.push(result.title);
    } else {
      console.log(`❌ Error: ${result.error}`);
      results.errors.push({ title: result.title, error: result.error });
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n📋 Sync Summary:');
  console.log(`  ✅ Created: ${results.created.length}`);
  console.log(`  🔄 Updated: ${results.updated.length}`);
  console.log(`  ❌ Errors: ${results.errors.length}\n`);

  if (results.errors.length > 0) {
    console.log('Error Details:');
    for (const error of results.errors) {
      console.log(`  • ${error.title}: ${error.error}`);
    }
    console.log();
  }

  // Final message
  if (results.errors.length === 0) {
    console.log('✅ Sync completed successfully!\n');
    console.log('Next steps:');
    console.log('  1. Check Crisp dashboard to verify uploads');
    console.log('  2. Test bot responses on your website');
    console.log('  3. Monitor analytics for bot performance');
  } else {
    console.log('⚠️  Sync completed with errors. Please review and retry.\n');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Fatal Error:', error.message);
  process.exit(1);
});

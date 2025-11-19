#!/usr/bin/env node

/**
 * Extract Help Content for Crisp Knowledge Base
 *
 * This script extracts all help article content from src/app/help/
 * and prepares it for Crisp AI Bot training.
 *
 * Usage:
 *   node scripts/extract-help-content.js [--format crisp|markdown|json]
 *
 * Output:
 *   - outputs/crisp-knowledge-base.json (for Crisp API)
 *   - outputs/help-content-backup.md (for reference)
 */

const fs = require('fs');
const path = require('path');

const HELP_DIR = path.join(__dirname, '../src/app/help');
const OUTPUT_DIR = path.join(__dirname, '../outputs');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Extract metadata and content from a help article file
 */
function extractArticleContent(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract title from HelpArticleLayout component
    const titleMatch = content.match(/title="([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : 'Untitled';

    // Extract category from HelpArticleLayout component
    const categoryMatch = content.match(/category="([^"]+)"/);
    const category = categoryMatch ? categoryMatch[1] : 'General';

    // Extract read time from HelpArticleLayout component
    const readTimeMatch = content.match(/readTime="([^"]+)"/);
    const readTime = readTimeMatch ? readTimeMatch[1] : 'Unknown';

    // Extract the JSX content between the tags
    const layoutStartMatch = content.match(/<HelpArticleLayout[^>]*>/);
    const layoutEndMatch = content.match(/<\/HelpArticleLayout>/);

    if (!layoutStartMatch || !layoutEndMatch) {
      console.warn(`  ⚠️  Could not find HelpArticleLayout in ${filePath}`);
      return null;
    }

    const layoutStart = layoutStartMatch.index + layoutStartMatch[0].length;
    const layoutEnd = layoutEndMatch.index;
    const jsxContent = content.substring(layoutStart, layoutEnd);

    // Convert JSX to plain text (simple regex-based conversion)
    const plainText = convertJSXToPlainText(jsxContent);

    return {
      title,
      category,
      readTime,
      content: plainText,
      filePath: filePath,
    };
  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Convert JSX to plain text/markdown
 */
function convertJSXToPlainText(jsxContent) {
  let text = jsxContent;

  // Remove className and other React props
  text = text.replace(/\s+(className|style|onClick|onChange|[a-z]+Ref)="[^"]*"/g, '');
  text = text.replace(/\s+className=\{[^}]*\}/g, '');

  // Handle heading tags
  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gs, '\n## $1\n');
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gs, '\n### $1\n');
  text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gs, '\n#### $1\n');

  // Handle paragraph tags
  text = text.replace(/<p[^>]*>(.*?)<\/p>/gs, '$1\n');

  // Handle lists
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

  // Handle list items not in a list
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gs, '- $1');

  // Handle strong/bold
  text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gs, '**$1**');
  text = text.replace(/<b[^>]*>(.*?)<\/b>/gs, '**$1**');

  // Handle emphasis/italic
  text = text.replace(/<em[^>]*>(.*?)<\/em>/gs, '*$1*');
  text = text.replace(/<i[^>]*>(.*?)<\/i>/gs, '*$1*');

  // Handle div containers (like tips, warnings, etc.)
  text = text.replace(/<div[^>]*>(.*?)<\/div>/gs, '$1');

  // Handle line breaks
  text = text.replace(/<br\s*\/?>/g, '\n');

  // Remove any remaining JSX elements
  text = text.replace(/<[^>]+>/g, '');

  // Clean up multiple newlines
  text = text.replace(/\n\n\n+/g, '\n\n');

  // Trim whitespace
  text = text.trim();

  return text;
}

/**
 * Recursively find all help articles
 */
function findHelpArticles(dir, articles = []) {
  try {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // Skip node_modules and other non-article directories
        if (!file.startsWith('.') && file !== 'node_modules') {
          findHelpArticles(filePath, articles);
        }
      } else if (file === 'page.tsx' && dir !== HELP_DIR) {
        // This is a help article (not the main help index page)
        articles.push(filePath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }

  return articles;
}

/**
 * Format articles for Crisp API
 */
function formatForCrisp(articles) {
  return {
    website_id: process.env.CRISP_WEBSITE_ID || '7acdaf6a-3b6a-4089-bd4e-d611e6362313',
    articles: articles.map((article, index) => ({
      id: `article_${index + 1}`,
      title: article.title,
      category: article.category,
      tags: [article.category.toLowerCase(), 'help', 'faq'],
      content: article.content,
      metadata: {
        read_time: article.readTime,
        source_file: article.filePath,
        extracted_at: new Date().toISOString(),
        language: 'pt-BR',
      },
    })),
  };
}

/**
 * Format articles as Markdown for reference
 */
function formatAsMarkdown(articles) {
  let markdown = '# JustoAI Help Content Backup\n\n';
  markdown += `Generated: ${new Date().toISOString()}\n\n`;
  markdown += `Total Articles: ${articles.length}\n\n`;
  markdown += '---\n\n';

  const groupedByCategory = {};
  for (const article of articles) {
    if (!groupedByCategory[article.category]) {
      groupedByCategory[article.category] = [];
    }
    groupedByCategory[article.category].push(article);
  }

  for (const [category, categoryArticles] of Object.entries(groupedByCategory)) {
    markdown += `## ${category}\n\n`;

    for (const article of categoryArticles) {
      markdown += `### ${article.title}\n\n`;
      markdown += `**Read Time:** ${article.readTime}\n\n`;
      markdown += `${article.content}\n\n`;
      markdown += '---\n\n';
    }
  }

  return markdown;
}

/**
 * Main execution
 */
async function main() {
  console.log('📚 Extracting Help Content for Crisp...\n');

  // Find all help articles
  console.log('🔍 Finding help articles...');
  const articlePaths = findHelpArticles(HELP_DIR);
  console.log(`  ✓ Found ${articlePaths.length} articles\n`);

  // Extract content from each article
  console.log('📄 Extracting content...');
  const articles = articlePaths
    .map(filePath => {
      process.stdout.write('  ');
      return extractArticleContent(filePath);
    })
    .filter(article => article !== null);

  console.log(`  ✓ Successfully extracted ${articles.length} articles\n`);

  // Group by category
  const groupedByCategory = {};
  for (const article of articles) {
    if (!groupedByCategory[article.category]) {
      groupedByCategory[article.category] = [];
    }
    groupedByCategory[article.category].push(article);
  }

  console.log('📊 Articles by Category:');
  for (const [category, categoryArticles] of Object.entries(groupedByCategory)) {
    console.log(`  • ${category}: ${categoryArticles.length} articles`);
  }
  console.log();

  // Generate output formats
  console.log('💾 Generating output files...\n');

  // Format for Crisp API
  const crispFormat = formatForCrisp(articles);
  const crispPath = path.join(OUTPUT_DIR, 'crisp-knowledge-base.json');
  fs.writeFileSync(crispPath, JSON.stringify(crispFormat, null, 2));
  console.log(`  ✓ Crisp Knowledge Base: ${crispPath}`);
  console.log(`    Size: ${(fs.statSync(crispPath).size / 1024).toFixed(2)} KB`);

  // Format as Markdown
  const markdownFormat = formatAsMarkdown(articles);
  const markdownPath = path.join(OUTPUT_DIR, 'help-content-backup.md');
  fs.writeFileSync(markdownPath, markdownFormat);
  console.log(`  ✓ Markdown Backup: ${markdownPath}`);
  console.log(`    Size: ${(fs.statSync(markdownPath).size / 1024).toFixed(2)} KB`);

  // Generate CSV for easy import
  const csvPath = path.join(OUTPUT_DIR, 'help-articles.csv');
  let csv = 'Title,Category,Read Time,Content Preview\n';
  for (const article of articles) {
    const preview = article.content.substring(0, 100).replace(/"/g, '""').replace(/\n/g, ' ');
    csv += `"${article.title.replace(/"/g, '""')}","${article.category}","${article.readTime}","${preview}..."\n`;
  }
  fs.writeFileSync(csvPath, csv);
  console.log(`  ✓ CSV Export: ${csvPath}`);
  console.log(`    Size: ${(fs.statSync(csvPath).size / 1024).toFixed(2)} KB`);

  console.log('\n✅ Content extraction complete!\n');

  console.log('📋 Next Steps:');
  console.log('  1. Review crisp-knowledge-base.json');
  console.log('  2. Upload to Crisp via API or dashboard');
  console.log('  3. Test bot responses');
  console.log('  4. Monitor analytics\n');

  console.log('📖 For more details, see: docs/CRISP_AI_BOT_SETUP.md\n');
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * Postinstall script para Prisma
 *
 * Problema: Em Docker, o schema.prisma pode não estar disponível durante npm install
 * Esta solução: Verifica se o schema existe antes de tentar gerar
 *
 * - Se schema.prisma existe: gera o cliente Prisma
 * - Se não existe: pula (será gerado depois no Dockerfile ou localmente)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const schemaPaths = [
  path.join(__dirname, '../prisma/schema.prisma'),
  path.join(__dirname, '../schema.prisma'),
  path.join(process.cwd(), 'prisma/schema.prisma'),
  path.join(process.cwd(), 'schema.prisma'),
];

let schemaPath = null;
for (const possiblePath of schemaPaths) {
  if (fs.existsSync(possiblePath)) {
    schemaPath = possiblePath;
    console.log(`✓ Found Prisma schema at: ${schemaPath}`);
    break;
  }
}

if (!schemaPath) {
  console.log('⚠ Prisma schema not found (normal during Docker build). Skipping prisma generate.');
  console.log('  It will be generated during the build process or when needed.');
  process.exit(0);
}

try {
  console.log('Generating Prisma Client...');
  // Use explicit --schema path to ensure it finds the right one
  execSync(`npx prisma generate --schema="${schemaPath}"`, { stdio: 'inherit' });
  console.log('✓ Prisma Client generated successfully');
} catch (error) {
  console.error('✗ Failed to generate Prisma Client:');
  console.error(error.message);
  process.exit(1);
}

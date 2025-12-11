
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

const OUTPUT_FILE = path.join(__dirname, '../schema_analysis_outputs.txt');

// Helper to append to file
function appendOutput(header: string, content: string) {
    const formattedHeader = `\n========================================\n${header}\n========================================\n`;
    fs.appendFileSync(OUTPUT_FILE, formattedHeader + content + '\n');
}

async function runCustomAudit() {
    console.log('Starting custom audit...');

    // Initialize file
    const initialContent = `JUSTOAI - ANÁLISE DE SCHEMA E BANCO DE DADOS
Data: ${new Date().toLocaleString()}
Gerado por: Gemini\n`;
    fs.writeFileSync(OUTPUT_FILE, initialContent);

    try {
        // OUTPUT 1: Schema Prisma COMPLETO
        console.log('Collecting Output 1...');
        const schemaPath = path.join(__dirname, '../prisma/schema.prisma');
        const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
        appendOutput('OUTPUT 1: SCHEMA PRISMA COMPLETO', schemaContent);

        // OUTPUT 2: Estrutura da tabela User
        console.log('Collecting Output 2...');
        const userStructure = await prisma.$queryRawUnsafe(`
            SELECT 
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_name = 'User'
            ORDER BY ordinal_position;
        `);
        appendOutput('OUTPUT 2: ESTRUTURA DA TABELA USER', JSON.stringify(userStructure, null, 2));

        // OUTPUT 3: Schema gerado do banco (DIFF)
        console.log('Collecting Output 3...');
        try {
            const dbPull = execSync('npx prisma db pull --print', { encoding: 'utf-8' });
            appendOutput('OUTPUT 3: SCHEMA GERADO DO BANCO (DIFF)', dbPull);
        } catch (e: any) {
            appendOutput('OUTPUT 3: SCHEMA GERADO DO BANCO (DIFF)', 'Error executing prisma db pull:\n' + e.message);
        }

        // OUTPUT 4: Lista de TODAS as tabelas com colunas
        console.log('Collecting Output 4...');
        const allTables = await prisma.$queryRawUnsafe(`
            SELECT 
                table_name,
                string_agg(column_name, ', ' ORDER BY ordinal_position) as columns
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name NOT LIKE '%_backup%'
              AND table_name NOT LIKE 'pg_%'
            GROUP BY table_name
            ORDER BY table_name;
        `);
        appendOutput('OUTPUT 4: TODAS AS TABELAS E SUAS COLUNAS', JSON.stringify(allTables, null, 2));

        // OUTPUT 5: Tabelas de telemetria/analytics
        console.log('Collecting Output 5...');
        const telemetryTables: any[] = await prisma.$queryRawUnsafe(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
              AND (
                table_name LIKE '%telemetry%' 
                OR table_name LIKE '%analytics%'
                OR table_name LIKE '%event%'
                OR table_name LIKE '%log%'
                OR table_name LIKE '%metric%'
                OR table_name LIKE '%tracking%'
                OR table_name LIKE '%audit%'
              )
            ORDER BY table_name;
        `);

        const telemetryOutput = telemetryTables.length > 0
            ? JSON.stringify(telemetryTables, null, 2)
            : "Nenhuma tabela encontrada";
        appendOutput('OUTPUT 5: TABELAS DE TELEMETRIA/ANALYTICS', telemetryOutput);

        // OUTPUT 6: Status de migrations
        console.log('Collecting Output 6...');
        try {
            // Use --allow-no-migrations to avoid error if no migrations found, though usually strict simply returns status
            const migrateStatus = execSync('npx prisma migrate status', { encoding: 'utf-8' });
            appendOutput('OUTPUT 6: STATUS DE MIGRATIONS', migrateStatus);
        } catch (e: any) {
            // npx prisma migrate status returns non-zero exit code if not in sync, we want to capture the output anyway
            if (e.stdout) {
                appendOutput('OUTPUT 6: STATUS DE MIGRATIONS', e.stdout.toString() + "\n" + (e.stderr ? e.stderr.toString() : ''));
            } else {
                appendOutput('OUTPUT 6: STATUS DE MIGRATIONS', 'Error executing prisma migrate status:\n' + e.message);
            }
        }

        // OUTPUT 7: Erro atual
        appendOutput('OUTPUT 7: ERRO ATUAL (SE HOUVER)', 'Nenhum erro no momento (Script executed successfully)');

        appendOutput('FIM DO RELATÓRIO', '');
        console.log('Custom audit complete. File saved to schema_analysis_outputs.txt');

    } catch (e: any) {
        console.error('Critical error in custom audit script:', e);
        appendOutput('OUTPUT 7: ERRO ATUAL (SE HOUVER)', 'CRITICAL SCRIPT ERROR: ' + e.message);
    } finally {
        await prisma.$disconnect();
    }
}

runCustomAudit();

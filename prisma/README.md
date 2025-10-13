# 🗃️ Database Schema - JustoAI v2

Este diretório contém o schema do banco de dados usando Prisma ORM.

## 📊 Estrutura do Banco

### **Multi-Tenant Architecture**
- `workspaces` - Isolamento por escritório/empresa
- `users` - Usuários do sistema
- `user_workspaces` - Relacionamento many-to-many com roles

### **Core Business Tables**
- `clients` - Clientes dos escritórios
- `cases` - Casos/processos jurídicos
- `case_events` - Eventos/movimentações dos casos
- `case_documents` - Documentos anexados aos casos

### **AI & Analysis**
- `case_analysis_versions` - Análises de IA versionadas
- `ai_cache` - Cache para economizar chamadas de IA

### **Reporting & Automation**
- `report_schedules` - Agendamento de relatórios automáticos

## 🚀 Comandos Disponíveis

```bash
# Instalar dependências
npm install prisma @prisma/client tsx bcryptjs
npm install -D @types/bcryptjs

# Gerar cliente Prisma
npm run db:generate

# Aplicar schema ao banco (desenvolvimento)
npm run db:push

# Criar migration
npm run db:migrate

# Aplicar migrations (produção)
npm run db:migrate:prod

# Popular banco com dados de exemplo
npm run db:seed

# Abrir Prisma Studio (GUI)
npm run db:studio

# Reset completo do banco
npm run db:reset
```

## ⚙️ Setup Inicial

1. **Configure a URL do banco no `.env.local`:**
```env
# Supabase Database URL
DATABASE_URL="postgresql://postgres.xxxxx:Nuwjjr$3@aws-1-sa-east-1.pooler.supabase.com:6543/postgres"

# Direct URL for migrations (optional)
DIRECT_URL="postgresql://postgres.xxxxx:Nuwjjr$3@aws-1-sa-east-1.pooler.supabase.com:5432/postgres"
```

2. **Gere o cliente Prisma:**
```bash
npm run db:generate
```

3. **Aplique o schema:**
```bash
npm run db:push
```

4. **Popule com dados de exemplo:**
```bash
npm run db:seed
```

## 📋 Dados de Exemplo (Seed)

O seed cria:
- ✅ 1 workspace: "ACME Law Firm"
- ✅ 2 usuários: Admin e Advogado
- ✅ 2 clientes: Empresa e Pessoa Física
- ✅ 2 casos: Cobrança e Divórcio
- ✅ Eventos de casos
- ✅ 1 análise de IA
- ✅ 1 agendamento de relatório
- ✅ Cache de IA exemplo

## 🔍 Principais Features

### **Multi-tenancy**
Isolamento completo por workspace, todas as tabelas têm `workspaceId`.

### **Audit Trail**
Todas as tabelas têm `createdAt` e `updatedAt` para rastreabilidade.

### **AI Cost Control**
- Cache inteligente para evitar chamadas duplicadas
- Tracking de tokens e custos por análise
- Expiração automática do cache

### **Flexible Metadata**
Campos `Json` para extensibilidade sem migrations.

### **Document Management**
- Storage no Supabase
- OCR status tracking
- Texto extraído para busca

## 🔧 Utilities

O arquivo `lib/prisma.ts` fornece:
- Cliente singleton
- Funções de conexão/desconexão
- Logs configuráveis por ambiente

## 📊 Prisma Studio

Para visualizar os dados graficamente:
```bash
npm run db:studio
```

Acesse: `http://localhost:5555`

## ⚠️ Importante

- **Produção**: Use `db:migrate:prod` ao invés de `db:push`
- **Backup**: Sempre faça backup antes de `db:reset`
- **Performance**: Índices já configurados nas foreign keys
- **Security**: Service Role Key necessária para algumas operações

---

*Schema atualizado em: 2025-09-13*
#!/bin/bash

# Script para iniciar o ambiente Docker do JustoAI

echo "🚀 Iniciando ambiente Docker do JustoAI v2..."

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker não está rodando. Por favor, inicie o Docker Desktop."
    exit 1
fi

# Verificar se arquivo .env.local existe
if [ ! -f ".env.local" ]; then
    echo "❌ Arquivo .env.local não encontrado. Por favor, configure as variáveis de ambiente."
    exit 1
fi

echo "📦 Criando e iniciando containers..."

# Iniciar apenas Redis primeiro
docker-compose up -d redis

echo "⏳ Aguardando Redis estar pronto..."
sleep 5

# Verificar se Redis está respondendo
until docker-compose exec redis redis-cli ping | grep -q PONG; do
    echo "⏳ Aguardando Redis..."
    sleep 2
done

echo "✅ Redis está pronto!"

# Iniciar todos os services
docker-compose up -d

echo "📊 Status dos containers:"
docker-compose ps

echo ""
echo "🎉 Ambiente Docker iniciado com sucesso!"
echo ""
echo "📍 Serviços disponíveis:"
echo "   • Aplicação: http://localhost:3000"
echo "   • Redis: localhost:6379"
echo "   • Supabase DB: localhost:5432"
echo "   • Supabase Studio: http://localhost:3001"
echo ""
echo "📝 Para parar os containers: docker-compose down"
echo "📝 Para ver logs: docker-compose logs -f"
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Home, ArrowLeft, Search, HelpCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Logo e Brand */}
        <div className="flex justify-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-3">
            <div className="w-12 h-12">
              <img
                src="/logo+nome.png"
                alt="JustoAI"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="font-display font-bold text-2xl text-primary-800">
              JustoAI
            </span>
          </Link>
        </div>

        {/* Ilustração do Erro 404 */}
        <div className="relative">
          <div className="text-9xl sm:text-[12rem] font-bold text-primary-100 select-none">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-6xl">🤔</div>
          </div>
        </div>

        {/* Card Principal */}
        <Card className="p-8 sm:p-10 shadow-2xl border border-neutral-200 bg-white/80 backdrop-blur-sm">
          <div className="space-y-6">
            {/* Título e Descrição */}
            <div className="space-y-4">
              <h1 className="font-display font-bold text-3xl sm:text-4xl text-primary-800">
                Ops! Não encontramos o que você procurava
              </h1>

              <p className="text-lg text-neutral-600 leading-relaxed max-w-lg mx-auto">
                A página que você está tentando acessar pode ter sido movida,
                removida ou o link pode estar incorreto.
              </p>
            </div>

            {/* Sugestões de Ação */}
            <div className="space-y-6">
              <div className="text-sm text-neutral-500">
                Algumas sugestões para te ajudar:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Voltar ao Início */}
                <Link href="/" className="block">
                  <Button
                    size="lg"
                    className="w-full h-14 bg-gradient-to-r from-accent-500 to-primary-800 hover:from-accent-600 hover:to-primary-900 text-white font-medium group"
                  >
                    <Home className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform" />
                    Voltar ao Início
                  </Button>
                </Link>

                {/* Página Anterior */}
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => window.history.back()}
                  className="w-full h-14 border-2 border-primary-200 text-primary-700 hover:bg-primary-50 font-medium group"
                >
                  <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
                  Voltar
                </Button>
              </div>
            </div>

            {/* Links Úteis */}
            <div className="pt-6 border-t border-neutral-200">
              <p className="text-sm text-neutral-600 mb-4">
                Ou explore outras páginas:
              </p>

              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  href="/pricing"
                  className="px-4 py-2 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  Preços
                </Link>
                <Link
                  href="/casos-de-uso"
                  className="px-4 py-2 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  Casos de Uso
                </Link>
                <Link
                  href="/blog"
                  className="px-4 py-2 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  Blog
                </Link>
                <Link
                  href="/help"
                  className="px-4 py-2 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  Ajuda
                </Link>
              </div>
            </div>

            {/* Busca Rápida */}
            <div className="pt-6">
              <div className="max-w-md mx-auto">
                <label htmlFor="search-404" className="block text-sm font-medium text-neutral-700 mb-2">
                  Ou tente buscar:
                </label>
                <div className="relative">
                  <input
                    id="search-404"
                    type="text"
                    placeholder="Digite o que você procura..."
                    className="w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const searchTerm = (e.target as HTMLInputElement).value;
                        if (searchTerm.trim()) {
                          // Redirecionar para busca ou página relevante
                          window.location.href = `/?search=${encodeURIComponent(searchTerm)}`;
                        }
                      }
                    }}
                  />
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-400 w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Informações de Contato */}
        <div className="bg-white/60 backdrop-blur-sm rounded-xl p-6 border border-neutral-200">
          <div className="flex items-center justify-center space-x-2 text-neutral-600">
            <HelpCircle className="w-5 h-5" />
            <span className="text-sm">
              Precisa de ajuda? Entre em contato:
            </span>
            <a
              href="mailto:contato@justoai.com.br"
              className="text-accent-600 hover:text-accent-700 font-medium text-sm"
            >
              contato@justoai.com.br
            </a>
          </div>
        </div>

        {/* Footer com Stats */}
        <div className="text-center space-y-4">
          <div className="flex justify-center space-x-8 text-sm text-neutral-500">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Sistema Online</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Suporte 24/7</span>
            </div>
          </div>

          <p className="text-xs text-neutral-400">
            © 2025 JustoAI. Transformando a advocacia com inteligência artificial.
          </p>
        </div>
      </div>
    </main>
  );
}
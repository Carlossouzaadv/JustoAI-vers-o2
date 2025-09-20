import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ICONS } from '../../../lib/icons';
import { articles } from './data/articles';

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="font-display font-bold text-4xl sm:text-5xl text-primary-800 mb-6">
              Blog JustoAI
            </h1>
            <p className="text-xl text-neutral-700 max-w-2xl mx-auto">
              Insights, dicas e estratégias para modernizar sua advocacia e impressionar seus clientes.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 mb-16">
            {articles.map((article) => (
              <Card key={article.id} className="p-6 hover:shadow-lg transition-all duration-300">
                <div className="mb-4">
                  <Badge variant="secondary" className="mb-2">
                    {article.category}
                  </Badge>
                  {article.featured && (
                    <Badge className="mb-2 ml-2 bg-accent-500">
                      Destaque
                    </Badge>
                  )}
                  <h3 className="font-display font-bold text-xl text-primary-800 mb-2 line-clamp-2">
                    {article.title}
                  </h3>
                  <p className="text-neutral-700 line-clamp-3">
                    {article.excerpt}
                  </p>
                </div>
                <div className="flex justify-between items-center text-sm text-neutral-500 mb-4">
                  <span>{new Date(article.publishedAt).toLocaleDateString('pt-BR')}</span>
                  <span>{article.readTime} min leitura</span>
                </div>
                <Link href={`/blog/${article.id}`}>
                  <Button variant="outline" size="sm" className="w-full">
                    Ler artigo
                    <span className="ml-2">{ICONS.ARROW_RIGHT}</span>
                  </Button>
                </Link>
              </Card>
            ))}
          </div>

          <div className="text-center bg-gradient-to-br from-accent-50 to-primary-50 rounded-2xl shadow-xl p-12">
            <div className="text-4xl mb-4">{ICONS.DOWNLOAD}</div>
            <h2 className="font-display font-bold text-3xl text-primary-800 mb-4">
              Baixe nosso Guia Gratuito
            </h2>
            <h3 className="font-semibold text-xl text-primary-700 mb-4">
              5 Prompts de IA Essenciais para Advogados Criarem Petições Mais Rápidas
            </h3>
            <p className="text-neutral-700 mb-6 max-w-2xl mx-auto text-lg">
              Descubra os prompts exatos que advogados estão usando para economizar horas na elaboração de petições. Este guia prático inclui templates prontos para usar e exemplos reais de aplicação.
            </p>
            <div className="bg-white rounded-xl p-6 mb-6 max-w-md mx-auto">
              <div className="space-y-3 text-left">
                <div className="flex items-center">
                  <span className="text-accent-500 mr-3">{ICONS.SUCCESS}</span>
                  <span className="text-neutral-700">5 prompts testados e aprovados</span>
                </div>
                <div className="flex items-center">
                  <span className="text-accent-500 mr-3">{ICONS.SUCCESS}</span>
                  <span className="text-neutral-700">Templates para diferentes tipos de petição</span>
                </div>
                <div className="flex items-center">
                  <span className="text-accent-500 mr-3">{ICONS.SUCCESS}</span>
                  <span className="text-neutral-700">Casos de uso práticos do dia a dia</span>
                </div>
                <div className="flex items-center">
                  <span className="text-accent-500 mr-3">{ICONS.SUCCESS}</span>
                  <span className="text-neutral-700">Acesso a atualizações exclusivas</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
              <input
                type="email"
                placeholder="Seu melhor email profissional"
                className="flex-1 px-4 py-3 border border-neutral-300 rounded-lg focus:outline-none focus:border-accent-500 text-center sm:text-left"
              />
              <Button size="lg" className="bg-accent-500 hover:bg-accent-600 text-white px-8">
                BAIXAR AGORA GRÁTIS
                <span className="ml-2">{ICONS.DOWNLOAD}</span>
              </Button>
            </div>
            <p className="text-sm text-neutral-500 mt-4">
              * Sem spam. Cancele quando quiser. Seus dados estão protegidos pela LGPD.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ICONS } from '../../../../lib/icons';
import { getArticleById, articles } from '../data/articles';

interface BlogPostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const article = getArticleById(slug);

  if (!article) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Link href="/blog" className="text-accent-500 hover:text-accent-600 font-medium mb-4 inline-flex items-center">
              <span className="mr-2">{ICONS.ARROW_LEFT}</span>
              Voltar ao Blog
            </Link>

            <div className="mb-4">
              <Badge variant="secondary" className="mb-2">
                {article.category}
              </Badge>
              {article.featured && (
                <Badge className="mb-2 ml-2 bg-accent-500">
                  Destaque
                </Badge>
              )}
            </div>

            <h1 className="font-display font-bold text-4xl sm:text-5xl text-primary-800 mb-6">
              {article.title}
            </h1>

            <div className="flex items-center gap-6 text-neutral-600 mb-6">
              <span className="flex items-center">
                <span className="mr-2">{ICONS.CALENDAR}</span>
                {new Date(article.publishedAt).toLocaleDateString('pt-BR')}
              </span>
              <span className="flex items-center">
                <span className="mr-2">{ICONS.CLOCK}</span>
                {article.readTime} min de leitura
              </span>
            </div>

            <p className="text-xl text-neutral-700 leading-relaxed">
              {article.excerpt}
            </p>
          </div>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Table of Contents */}
            {article.tableOfContents && article.tableOfContents.length > 0 && (
              <div className="lg:col-span-1">
                <div className="sticky top-8">
                  <Card className="p-6">
                    <h3 className="font-semibold text-lg text-primary-800 mb-4">
                      Índice
                    </h3>
                    <nav className="space-y-2">
                      {article.tableOfContents.map((item) => (
                        <a
                          key={item.id}
                          href={`#${item.id}`}
                          className={`block text-sm hover:text-accent-500 transition-colors ${
                            item.level === 2 ? 'text-neutral-700' : 'text-neutral-500 ml-4'
                          }`}
                        >
                          {item.title}
                        </a>
                      ))}
                    </nav>
                  </Card>
                </div>
              </div>
            )}

            {/* Article Content */}
            <div className={article.tableOfContents ? 'lg:col-span-3' : 'lg:col-span-4'}>
              <div className="bg-white rounded-2xl shadow-xl p-8 lg:p-12">
                <div
                  className="prose prose-lg max-w-none prose-primary"
                  dangerouslySetInnerHTML={{ __html: article.content.replace(/\n/g, '<br/>') }}
                />

                {/* Contextual CTA */}
                <div className="mt-12 p-6 bg-gradient-to-r from-accent-50 to-primary-50 rounded-xl border border-accent-200">
                  <div className="text-center">
                    <h3 className="font-semibold text-xl text-primary-800 mb-2">
                      Quer ver como funciona na prática?
                    </h3>
                    <p className="text-neutral-700 mb-4">
                      Experimente a JustoAI gratuitamente e descubra como economizar horas de trabalho com automação inteligente.
                    </p>
                    <Link href="/signup">
                      <Button className="bg-accent-500 hover:bg-accent-600 text-white">
                        Iniciar teste de 7 dias grátis
                        <span className="ml-2">{ICONS.ARROW_RIGHT}</span>
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Author Bio */}
                <div className="mt-12 pt-8 border-t border-neutral-200">
                  <h3 className="font-semibold text-xl text-primary-800 mb-4">
                    Sobre o Autor
                  </h3>
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-primary-600 text-xl font-semibold">
                        {article.author.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg text-primary-800 mb-2">
                        {article.author.name}
                      </h4>
                      <p className="text-neutral-700">
                        {article.author.bio}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Related Articles */}
          <div className="mt-16">
            <h2 className="font-display font-bold text-3xl text-primary-800 mb-8 text-center">
              Artigos Relacionados
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {articles
                .filter(a => a.id !== article.id && a.category === article.category)
                .slice(0, 3)
                .map((relatedArticle) => (
                  <Card key={relatedArticle.id} className="p-6 hover:shadow-lg transition-all duration-300">
                    <Badge variant="secondary" className="mb-2">
                      {relatedArticle.category}
                    </Badge>
                    <h3 className="font-semibold text-lg text-primary-800 mb-2 line-clamp-2">
                      {relatedArticle.title}
                    </h3>
                    <p className="text-neutral-700 text-sm line-clamp-2 mb-4">
                      {relatedArticle.excerpt}
                    </p>
                    <Link href={`/blog/${relatedArticle.id}`}>
                      <Button variant="outline" size="sm" className="w-full">
                        Ler artigo
                        <span className="ml-2">{ICONS.ARROW_RIGHT}</span>
                      </Button>
                    </Link>
                  </Card>
                ))}
            </div>
          </div>

          {/* Newsletter CTA */}
          <div className="mt-16 text-center bg-gradient-to-br from-accent-50 to-primary-50 rounded-2xl shadow-xl p-8">
            <div className="text-3xl mb-4">{ICONS.DOWNLOAD}</div>
            <h2 className="font-display font-bold text-2xl text-primary-800 mb-4">
              Gostou do conteúdo?
            </h2>
            <p className="text-neutral-700 mb-6 max-w-md mx-auto">
              Baixe nosso guia gratuito com 5 prompts de IA essenciais para advogados criarem petições mais rápidas.
            </p>
            <Button className="bg-accent-500 hover:bg-accent-600 text-white">
              BAIXAR GUIA GRÁTIS
              <span className="ml-2">{ICONS.DOWNLOAD}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export async function generateStaticParams() {
  return articles.map((article) => ({
    slug: article.id,
  }));
}
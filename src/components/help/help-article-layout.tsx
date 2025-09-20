import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ICONS } from '../../../lib/icons';

interface HelpArticleLayoutProps {
  title: string;
  category: string;
  readTime: string;
  children: React.ReactNode;
}

export function HelpArticleLayout({ title, category, readTime, children }: HelpArticleLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Navigation */}
          <div className="flex items-center gap-4 mb-8">
            <Link href="/help">
              <Button variant="outline" size="sm">
                <span className="mr-2">{ICONS.ARROW_LEFT}</span>
                Voltar à Central de Ajuda
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" size="sm">
                <span className="mr-2">{ICONS.ARROW_LEFT}</span>
                Página inicial
              </Button>
            </Link>
          </div>

          {/* Article Header */}
          <div className="bg-white rounded-2xl shadow-xl p-8 lg:p-12">
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-4">
                <span className="px-3 py-1 bg-accent-100 text-accent-700 rounded-full text-sm font-medium">
                  {category}
                </span>
                <span className="text-sm text-neutral-500 flex items-center">
                  <span className="mr-1">{ICONS.CLOCK}</span>
                  {readTime}
                </span>
              </div>
              <h1 className="font-display font-bold text-3xl sm:text-4xl text-primary-800 mb-4">
                {title}
              </h1>
            </div>

            {/* Article Content */}
            <div className="prose prose-lg max-w-none">
              {children}
            </div>

            {/* Footer Navigation */}
            <div className="mt-12 pt-8 border-t border-neutral-200">
              <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <Link href="/help">
                  <Button variant="outline">
                    <span className="mr-2">{ICONS.ARROW_LEFT}</span>
                    Voltar à Central de Ajuda
                  </Button>
                </Link>
                <div className="flex gap-2">
                  <a href="mailto:suporte@justoai.com.br">
                    <Button className="bg-accent-500 hover:bg-accent-600">
                      Precisa de ajuda?
                      <span className="ml-2">{ICONS.MAIL}</span>
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
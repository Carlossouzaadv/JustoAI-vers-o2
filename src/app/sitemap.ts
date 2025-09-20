import { MetadataRoute } from 'next'
import { articles } from './blog/data/articles'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://justoai.com.br'

  // Static pages
  const staticPages = [
    '',
    '/casos-de-uso',
    '/about',
    '/blog',
    '/careers',
    '/contact',
    '/contato-suporte',
    '/help',
    '/partners',
    '/press',
    '/privacy',
    '/terms',
    '/lgpd',
    '/security',
    '/cookies',
  ]

  const staticUrls = staticPages.map(page => ({
    url: `${baseUrl}${page}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: page === '' ? 1 : 0.8,
  }))

  // Blog posts
  const blogUrls = articles.map(article => ({
    url: `${baseUrl}/blog/${article.slug}`,
    lastModified: new Date(article.date),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  return [...staticUrls, ...blogUrls]
}
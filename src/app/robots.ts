import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/app/', '/login/', '/signup/', '/dashboard/'],
    },
    sitemap: 'https://justoai.com.br/sitemap.xml',
  }
}
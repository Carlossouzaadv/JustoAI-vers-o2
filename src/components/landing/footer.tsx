'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ICONS } from '../../lib/icons';
import { Button } from '../../components/ui/button';

const footerLinks = {
  product: [
    { name: 'Recursos', href: '#features' },
    { name: 'Como Funciona', href: '#how-it-works' },
    { name: 'Preços', href: '#pricing' },
    { name: 'Demo', href: '/onboarding-demo' },
  ],
  company: [
    { name: 'Sobre nós', href: '/about' },
    { name: 'Blog', href: '/blog' },
    { name: 'Carreiras', href: '/careers' },
    { name: 'Imprensa', href: '/press' },
    { name: 'Parceiros', href: '/partners' },
  ],
  support: [
    { name: 'Central de Ajuda', href: '/help' },
    { name: 'Contato', href: '/contact' },
    { name: 'Reportar um Problema', href: 'mailto:suporte@justoai.com.br?subject=Reporte%20de%20Instabilidade' },
  ],
  legal: [
    { name: 'Termos de Uso', href: '/terms' },
    { name: 'Política de Privacidade', href: '/privacy' },
    { name: 'LGPD', href: '/lgpd' },
    { name: 'Cookies', href: '/cookies' },
    { name: 'Segurança', href: '/security' },
  ],
};

const socialLinks = [
  { name: 'LinkedIn', href: 'https://linkedin.com/company/justoai', icon: ICONS.LINKEDIN },
  { name: 'Instagram', href: 'https://www.instagram.com/justo.ai/', icon: ICONS.INSTAGRAM },
];

export function Footer() {
  return (
    <footer className="bg-primary-900 text-white border-t border-primary-800">
      {/* Main Footer */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-6 gap-8">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10">
                <Image
                  src="/logo+nome.png"
                  alt="JustoAI"
                  width={40}
                  height={40}
                  className="object-contain w-full h-full"
                />
              </div>
              <span className="font-display font-bold text-2xl">
                JustoAI
              </span>
            </Link>

            <p className="text-primary-200 text-lg leading-relaxed mb-6">
              Transformamos advogados em consultores estratégicos, eliminando 20 horas semanais
              de trabalho manual com automação inteligente.
            </p>

            <div className="space-y-4">
              <div className="flex items-center text-primary-200 group">
                <span className="mr-3 group-hover:text-accent-400 transition-colors">{ICONS.MAIL}</span>
                <a href="mailto:contato@justoai.com.br" className="hover:text-white transition-colors border-b border-transparent hover:border-white">
                  contato@justoai.com.br
                </a>
              </div>
              <div className="flex items-center text-primary-200">
                <span className="mr-3">{ICONS.LOCATION}</span>
                <span>Rio de Janeiro, RJ - Brasil</span>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex space-x-4 mt-6">
              {socialLinks.map((social) => (
                <motion.a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-10 h-10 bg-primary-800 rounded-lg flex items-center justify-center text-primary-200 hover:bg-primary-700 hover:text-white transition-all duration-200"
                >
                  {social.icon}
                </motion.a>
              ))}
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h3 className="font-display font-semibold text-lg mb-6 text-white/90">Produto</h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-primary-200 hover:text-white transition-colors duration-200 text-sm"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="font-display font-semibold text-lg mb-6 text-white/90">Empresa</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-primary-200 hover:text-white transition-colors duration-200 text-sm"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h3 className="font-display font-semibold text-lg mb-6 text-white/90">Suporte</h3>
            <ul className="space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-primary-200 hover:text-white transition-colors duration-200 text-sm"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="font-display font-semibold text-lg mb-6 text-white/90">Legal</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-primary-200 hover:text-white transition-colors duration-200 text-sm"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Newsletter Section - Optimized */}
        <div className="mt-16 pt-10 border-t border-primary-800/50">
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            <div>
              <h3 className="font-display font-bold text-2xl mb-3 text-white">
                Newsletter Semanal: Automação Jurídica na Prática
              </h3>
              <p className="text-primary-200 mb-4 leading-relaxed">
                Toda segunda-feira, enviamos 1 estratégia prática para economizar tempo com automação. <strong className="text-white">1.500+ advogados já recebem.</strong>
              </p>
              <div className="flex flex-wrap gap-4 text-xs font-medium text-primary-400">
                <span className="flex items-center"><span className="text-accent-400 mr-1">✓</span> Casos de uso reais</span>
                <span className="flex items-center"><span className="text-accent-400 mr-1">✓</span> ROI comprovado</span>
                <span className="flex items-center"><span className="text-accent-400 mr-1">✓</span> Cancele a qualquer momento</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <form className="flex gap-2">
                <input
                  type="email"
                  placeholder="seuemail@escritorio.com.br"
                  className="flex-1 px-4 py-3 rounded-lg bg-primary-800 border-2 border-primary-700 text-white placeholder-primary-400 focus:outline-none focus:border-accent-500 focus:bg-primary-900 transition-all"
                />
                <Button className="bg-accent-500 hover:bg-accent-600 text-white font-semibold transition-colors duration-200 shrink-0">
                  Quero Receber
                  <span className="ml-2 hidden sm:inline">{ICONS.ARROW_RIGHT}</span>
                </Button>
              </form>
              <p className="text-xs text-primary-500">
                Enviamos 1x por semana. Dados protegidos pela LGPD.
              </p>
            </div>
          </div>
        </div>

        {/* Certifications */}
        <div className="mt-12 pt-8 border-t border-primary-800/50">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2 text-primary-300">
                <span className="text-xl">{ICONS.SHIELD}</span>
                <span className="text-sm font-medium">LGPD Compliant</span>
              </div>
              <div className="flex items-center space-x-2 text-primary-300">
                <span className="text-xl">{ICONS.LOCK}</span>
                <span className="text-sm font-medium">SSL Seguro</span>
              </div>
            </div>
            <div className="text-primary-400 text-xs">
              Servidores no Brasil • Dados protegidos pela LGPD
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="bg-primary-950 py-8 border-t border-primary-900">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center text-primary-400 text-sm">
            <div className="text-center md:text-left">
              <p className="mb-2">© 2024 JustoAI. Todos os direitos reservados.</p>
              {/* Beta Disclaimer */}
              <p className="text-xs text-primary-600 max-w-md">
                Versão Beta: Algumas funcionalidades ainda estão em desenvolvimento sob forte demanda. <Link href="/feedback" className="underline hover:text-primary-300">Sua opinião</Link> é muito importante!
              </p>
            </div>
            <div className="flex flex-col items-center md:items-end space-y-2 mt-6 md:mt-0">
              <span className="font-mono text-xs opacity-70">CNPJ: 60.972.526/0001-65</span>
              <div className="flex items-center space-x-2">
                <span>Feito com {ICONS.HEART} no Brasil</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
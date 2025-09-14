'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ICONS } from '../../../lib/icons';

const footerLinks = {
  product: [
    { name: 'Recursos', href: '#features' },
    { name: 'Como Funciona', href: '#how-it-works' },
    { name: 'Preços', href: '#pricing' },
    { name: 'Demo', href: '/demo' },
    { name: 'Roadmap', href: '/roadmap' },
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
    { name: 'Documentação', href: '/docs' },
    { name: 'Suporte Técnico', href: '/support' },
    { name: 'Status', href: '/status' },
    { name: 'Contato', href: '/contact' },
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
  { name: 'Twitter', href: 'https://twitter.com/justoai', icon: ICONS.TWITTER },
  { name: 'YouTube', href: 'https://youtube.com/@justoai', icon: ICONS.YOUTUBE },
  { name: 'Instagram', href: 'https://instagram.com/justoai', icon: ICONS.INSTAGRAM },
];

export function Footer() {
  return (
    <footer className="bg-primary-900 text-white">
      {/* Main Footer */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid lg:grid-cols-6 gap-8">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center space-x-3 mb-6">
              <div className="relative w-10 h-10">
                <Image
                  src="/logo+nome.png"
                  alt="JustoAI"
                  fill
                  className="object-contain brightness-0 invert"
                />
              </div>
              <span className="font-display font-bold text-2xl">
                JustoAI
              </span>
            </Link>

            <p className="text-primary-200 text-lg leading-relaxed mb-6">
              Transformamos advogados em consultores estratégicos, eliminando 20 horas semanais
              de trabalho manual com inteligência artificial.
            </p>

            <div className="space-y-4">
              <div className="flex items-center text-primary-200">
                <span className="mr-3">{ICONS.MAIL}</span>
                <a href="mailto:contato@justoai.com.br" className="hover:text-white transition-colors">
                  contato@justoai.com.br
                </a>
              </div>
              <div className="flex items-center text-primary-200">
                <span className="mr-3">{ICONS.PHONE}</span>
                <a href="tel:+5511999999999" className="hover:text-white transition-colors">
                  (11) 99999-9999
                </a>
              </div>
              <div className="flex items-center text-primary-200">
                <span className="mr-3">{ICONS.LOCATION}</span>
                <span>São Paulo, SP - Brasil</span>
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
            <h3 className="font-display font-semibold text-lg mb-6">Produto</h3>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-primary-200 hover:text-white transition-colors duration-200"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h3 className="font-display font-semibold text-lg mb-6">Empresa</h3>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-primary-200 hover:text-white transition-colors duration-200"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h3 className="font-display font-semibold text-lg mb-6">Suporte</h3>
            <ul className="space-y-3">
              {footerLinks.support.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-primary-200 hover:text-white transition-colors duration-200"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="font-display font-semibold text-lg mb-6">Legal</h3>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-primary-200 hover:text-white transition-colors duration-200"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Newsletter Section */}
        <div className="mt-16 pt-8 border-t border-primary-800">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="font-display font-bold text-2xl mb-2">
                Fique por dentro das novidades
              </h3>
              <p className="text-primary-200">
                Receba dicas exclusivas sobre automação jurídica e atualizações do produto.
              </p>
            </div>
            <div className="flex gap-4">
              <input
                type="email"
                placeholder="Seu melhor email"
                className="flex-1 px-4 py-3 rounded-lg bg-primary-800 border border-primary-700 text-white placeholder-primary-300 focus:outline-none focus:border-accent-500"
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="bg-accent-500 hover:bg-accent-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-200"
              >
                Inscrever
              </motion.button>
            </div>
          </div>
        </div>

        {/* Certifications */}
        <div className="mt-12 pt-8 border-t border-primary-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2 text-primary-200">
                <span>{ICONS.SHIELD}</span>
                <span className="text-sm">LGPD Compliant</span>
              </div>
              <div className="flex items-center space-x-2 text-primary-200">
                <span>{ICONS.SHIELD}</span>
                <span className="text-sm">SSL Seguro</span>
              </div>
              <div className="flex items-center space-x-2 text-primary-200">
                <span>{ICONS.SHIELD}</span>
                <span className="text-sm">ISO 27001</span>
              </div>
            </div>
            <div className="text-primary-200 text-sm">
              Servidores no Brasil • Dados protegidos pela LGPD
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="bg-primary-950 py-6">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center text-primary-300 text-sm">
            <div>
              © 2024 JustoAI. Todos os direitos reservados.
            </div>
            <div className="flex items-center space-x-6 mt-4 md:mt-0">
              <span>CNPJ: 00.000.000/0001-00</span>
              <span>•</span>
              <span>Feito com {ICONS.HEART} no Brasil</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
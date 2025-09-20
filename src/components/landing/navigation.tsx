'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ICONS } from '../../../lib/icons';

export function Navigation() {
  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50 bg-primary-900/95 backdrop-blur-lg border-b border-primary-800"
    >
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 lg:w-12 lg:h-12">
              <Image
                src="/logo+nome.png"
                alt="JustoAI"
                width={48}
                height={48}
                className="object-contain w-full h-full"
                priority
              />
            </div>
            <span className="font-display font-bold text-xl lg:text-2xl text-white">
              JustoAI
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            <Link
              href="#features"
              className="text-primary-200 hover:text-white transition-colors duration-200 font-medium"
            >
              Recursos
            </Link>
            <Link
              href="/casos-de-uso"
              className="text-primary-200 hover:text-white transition-colors duration-200 font-medium"
            >
              Casos de Uso
            </Link>
            <Link
              href="#how-it-works"
              className="text-primary-200 hover:text-white transition-colors duration-200 font-medium"
            >
              Como Funciona
            </Link>
            <Link
              href="#pricing"
              className="text-primary-200 hover:text-white transition-colors duration-200 font-medium"
            >
              Preços
            </Link>
            <Link
              href="#testimonials"
              className="text-primary-200 hover:text-white transition-colors duration-200 font-medium"
            >
              Depoimentos
            </Link>
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center space-x-4">
            <Link href="/login" className="hidden sm:inline-flex">
              <Button
                variant="ghost"
                className="text-white hover:bg-primary-800 border border-primary-700 hover:border-primary-600 transition-all duration-200"
              >
                Entrar
              </Button>
            </Link>
            <Link href="/signup">
              <Button className="bg-gradient-to-r from-accent-500 to-primary-800 hover:from-accent-600 hover:to-primary-900 text-white px-6 py-2 text-sm lg:text-base shadow-lg hover:shadow-xl transition-all duration-200 border-0">
                Testar Grátis
                <span className="ml-2">{ICONS.ARROW_RIGHT}</span>
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button className="lg:hidden p-2 rounded-md text-white hover:bg-primary-800">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </nav>
    </motion.header>
  );
}
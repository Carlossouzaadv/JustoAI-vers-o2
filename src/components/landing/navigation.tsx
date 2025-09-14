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
      className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-neutral-200"
    >
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3">
            <div className="relative w-10 h-10 lg:w-12 lg:h-12">
              <Image
                src="/logo+nome.png"
                alt="JustoAI"
                fill
                className="object-contain"
                priority
              />
            </div>
            <span className="font-display font-bold text-xl lg:text-2xl text-primary-800">
              JustoAI
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            <Link
              href="#features"
              className="text-neutral-700 hover:text-primary-800 transition-colors duration-200 font-medium"
            >
              Recursos
            </Link>
            <Link
              href="#how-it-works"
              className="text-neutral-700 hover:text-primary-800 transition-colors duration-200 font-medium"
            >
              Como Funciona
            </Link>
            <Link
              href="#pricing"
              className="text-neutral-700 hover:text-primary-800 transition-colors duration-200 font-medium"
            >
              Preços
            </Link>
            <Link
              href="#testimonials"
              className="text-neutral-700 hover:text-primary-800 transition-colors duration-200 font-medium"
            >
              Depoimentos
            </Link>
          </div>

          {/* CTA Buttons */}
          <div className="flex items-center space-x-4">
            <Link href="/login" className="hidden sm:inline-flex">
              <Button variant="ghost" className="text-primary-800 hover:bg-primary-50">
                Entrar
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button className="bg-primary-800 hover:bg-primary-700 text-white px-6 py-2 text-sm lg:text-base">
                Testar Grátis
                <span className="ml-2">{ICONS.ARROW_RIGHT}</span>
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button className="lg:hidden p-2 rounded-md text-neutral-700 hover:bg-neutral-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </nav>
    </motion.header>
  );
}
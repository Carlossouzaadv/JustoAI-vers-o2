'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { ICONS } from '@/lib/icons';

export function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Detectar scroll para mudar aparência da navegação
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fechar menu mobile ao redimensionar tela
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevenir scroll quando menu mobile está aberto
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const menuItems = [
    { href: '#features', label: 'Recursos' },
    { href: '/casos-de-uso', label: 'Casos de Uso' },
    { href: '#how-it-works', label: 'Como Funciona' },
    { href: '#pricing', label: 'Preços' },
    { href: '#testimonials', label: 'Depoimentos' }
  ];

  const handleMobileMenuClick = (href: string) => {
    setIsMobileMenuOpen(false);
    // Se é link interno, fazer scroll suave
    if (href.startsWith('#')) {
      setTimeout(() => {
        const element = document.querySelector(href);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      }, 100);
    }
  };

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-primary-900/98 backdrop-blur-lg border-b border-primary-800 shadow-lg'
            : 'bg-primary-900/95 backdrop-blur-lg border-b border-primary-800'
        }`}
      >
        <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center space-x-2 lg:space-x-3 z-10">
              <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12">
                <Image
                  src="/optimized/Justo_logo.webp"
                  alt="JustoAI"
                  width={48}
                  height={48}
                  className="object-contain w-full h-full"
                  priority
                />
              </div>
              <span className="font-display font-bold text-lg sm:text-xl lg:text-2xl text-white">
                JustoAI
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-8">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-primary-200 hover:text-white transition-colors duration-200 font-medium text-base"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Desktop CTA Buttons */}
            <div className="hidden sm:flex items-center space-x-3 lg:space-x-4">
              <Link href="/login" className="hidden md:inline-flex">
                <Button
                  variant="ghost"
                  className="text-white hover:bg-primary-800 border border-primary-700 hover:border-primary-600 transition-all duration-200 h-10 px-4 text-sm lg:text-base"
                >
                  Entrar
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-gradient-to-r from-accent-500 to-primary-800 hover:from-accent-600 hover:to-primary-900 text-white px-4 lg:px-6 py-2 text-sm lg:text-base shadow-lg hover:shadow-xl transition-all duration-200 border-0 h-10 lg:h-11">
                  Testar Grátis
                  <span className="ml-2">→</span>
                </Button>
              </Link>
            </div>

            {/* Mobile CTA + Menu Button */}
            <div className="flex items-center space-x-2 sm:hidden">
              <Link href="/signup">
                <Button size="sm" className="bg-gradient-to-r from-accent-500 to-primary-800 hover:from-accent-600 hover:to-primary-900 text-white px-3 py-1.5 text-sm shadow-lg transition-all duration-200 border-0">
                  Teste Grátis
                </Button>
              </Link>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-md text-white hover:bg-primary-800 transition-colors duration-200 touch-manipulation"
                aria-label="Abrir menu"
                aria-expanded={isMobileMenuOpen}
              >
                <motion.div
                  animate={isMobileMenuOpen ? 'open' : 'closed'}
                  className="w-6 h-6 flex flex-col justify-center items-center"
                >
                  <motion.span
                    variants={{
                      closed: { rotate: 0, y: 0 },
                      open: { rotate: 45, y: 6 }
                    }}
                    className="w-6 h-0.5 bg-white block transition-all duration-300 origin-center"
                  />
                  <motion.span
                    variants={{
                      closed: { opacity: 1 },
                      open: { opacity: 0 }
                    }}
                    className="w-6 h-0.5 bg-white block transition-all duration-300 mt-1.5"
                  />
                  <motion.span
                    variants={{
                      closed: { rotate: 0, y: 0 },
                      open: { rotate: -45, y: -6 }
                    }}
                    className="w-6 h-0.5 bg-white block transition-all duration-300 mt-1.5 origin-center"
                  />
                </motion.div>
              </button>
            </div>
          </div>
        </nav>
      </motion.header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Menu Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3, ease: 'easeInOut' }}
              className="fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-primary-900 z-50 lg:hidden overflow-y-auto"
            >
              <div className="p-6 pt-24">
                {/* Mobile Navigation Links */}
                <nav className="space-y-6">
                  {menuItems.map((item, index) => (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => handleMobileMenuClick(item.href)}
                        className="block text-white text-lg font-medium py-3 px-4 rounded-lg hover:bg-primary-800 transition-colors duration-200 touch-manipulation"
                      >
                        {item.label}
                      </Link>
                    </motion.div>
                  ))}
                </nav>

                {/* Mobile CTA Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mt-8 pt-8 border-t border-primary-800 space-y-4"
                >
                  <Link
                    href="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block"
                  >
                    <Button
                      variant="ghost"
                      className="w-full text-white hover:bg-primary-800 border border-primary-700 hover:border-primary-600 transition-all duration-200 h-12 text-base touch-manipulation"
                    >
                      Entrar
                    </Button>
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block"
                  >
                    <Button className="w-full bg-gradient-to-r from-accent-500 to-primary-800 hover:from-accent-600 hover:to-primary-900 text-white h-12 text-base shadow-lg hover:shadow-xl transition-all duration-200 border-0 touch-manipulation">
                      Testar Grátis
                      <span className="ml-2">→</span>
                    </Button>
                  </Link>
                </motion.div>

                {/* Contact Info */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="mt-8 pt-8 border-t border-primary-800"
                >
                  <p className="text-primary-200 text-sm mb-4">
                    Precisa de ajuda?
                  </p>
                  <Link
                    href="/contact"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-accent-400 hover:text-accent-300 transition-colors duration-200 text-sm touch-manipulation"
                  >
                    Entre em contato →
                  </Link>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
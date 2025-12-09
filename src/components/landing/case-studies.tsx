'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { ICONS } from '../../lib/icons';

const caseStudies = [
    {
        icon: ICONS.USER,
        scenario: 'Advogado Solo',
        result: {
            headline: 'De 15h para 30min',
            description: 'Redução drástica no tempo semanal gasto com relatórios manuais e acompanhamento.'
        },
        benefit: '58 horas/mês liberadas para focar em novos clientes',
        color: 'from-blue-500 to-cyan-500'
    },
    {
        icon: ICONS.USERS,
        scenario: 'Escritório Médio (5 advogados)',
        result: {
            headline: 'R$ 180K/ano',
            description: 'Economia estimada em horas de trabalho administrativo e operacional da equipe.'
        },
        benefit: 'ROI de 36x no primeiro ano de uso',
        color: 'from-accent-500 to-accent-600'
    },
    {
        icon: ICONS.BUILDING,
        scenario: 'Departamento Jurídico',
        result: {
            headline: '60% → 98%',
            description: 'Aumento na taxa de satisfação dos clientes internos com respostas mais rápidas.'
        },
        benefit: 'Melhor retenção e agilidade na tomada de decisão',
        color: 'from-purple-500 to-pink-500'
    }
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
        },
    },
};

const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: {
            duration: 0.6,
        },
    },
};

export function CaseStudies() {
    return (
        <section id="case-studies" className="py-24 bg-gradient-to-br from-primary-50 via-white to-accent-50">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <Badge variant="secondary" className="mb-4 bg-accent-50 text-accent-700 border-accent-200">
                        Casos de Uso
                    </Badge>
                    <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-primary-800 mb-6">
                        <span className="bg-gradient-to-r from-accent-500 to-accent-600 bg-clip-text text-transparent">
                            Resultados Reais
                        </span>
                        <span className="block">
                            para cada perfil
                        </span>
                    </h2>
                    <p className="text-lg text-neutral-700 max-w-3xl mx-auto">
                        Veja como o JustoAI se adapta e gera valor para diferentes realidades jurídicas.
                    </p>
                </motion.div>

                {/* Case Studies Grid */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    className="grid lg:grid-cols-3 gap-8 mb-16"
                >
                    {caseStudies.map((study, index) => (
                        <motion.div key={index} variants={itemVariants}>
                            <Card className="p-8 h-full bg-white border-neutral-200 hover:shadow-xl transition-all duration-300 group relative overflow-hidden">
                                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${study.color}`} />

                                {/* Header */}
                                <div className="flex items-center gap-4 mb-6">
                                    <div className={`p-3 rounded-lg bg-gradient-to-br ${study.color} bg-opacity-10 text-white shadow-md`}>
                                        {study.icon}
                                    </div>
                                    <h3 className="font-bold text-xl text-primary-800">
                                        {study.scenario}
                                    </h3>
                                </div>

                                {/* Result */}
                                <div className="mb-6">
                                    <div className={`text-4xl font-bold mb-2 bg-gradient-to-r ${study.color} bg-clip-text text-transparent`}>
                                        {study.result.headline}
                                    </div>
                                    <p className="text-neutral-600 leading-relaxed">
                                        {study.result.description}
                                    </p>
                                </div>

                                {/* Benefit */}
                                <div className="pt-6 border-t border-neutral-100">
                                    <div className="flex items-start gap-2">
                                        <span className="text-accent-500 mt-1">→</span>
                                        <span className="font-medium text-neutral-800">
                                            {study.benefit}
                                        </span>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </motion.div>

                {/* CTA Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                    className="mt-16 text-center p-8 bg-gradient-to-r from-primary-800 to-primary-700 rounded-2xl text-white shadow-2xl relative overflow-hidden"
                >
                    {/* Background decoration */}
                    <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-10 pointer-events-none">
                        <div className="absolute top-[-50%] left-[-10%] w-[500px] h-[500px] rounded-full bg-accent-500 blur-3xl"></div>
                        <div className="absolute bottom-[-50%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500 blur-3xl"></div>
                    </div>

                    <div className="relative z-10">
                        <h3 className="font-display font-bold text-2xl lg:text-3xl mb-4">
                            Qual é o seu cenário?
                        </h3>
                        <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
                            Não importa o tamanho da sua operação, o JustoAI tem a ferramenta certa para multiplicar sua produtividade.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link href="/signup">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="bg-white text-primary-800 px-8 py-3 rounded-lg font-semibold hover:bg-neutral-100 transition-colors shadow-lg"
                                >
                                    Começar Teste Grátis
                                    <span className="ml-2">{ICONS.ARROW_RIGHT}</span>
                                </motion.button>
                            </Link>
                            <Link href="/onboarding-demo">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="border-2 border-white/30 bg-white/10 text-white px-8 py-3 rounded-lg font-semibold hover:bg-white/20 transition-colors backdrop-blur-sm"
                                >
                                    {ICONS.PLAY} Ver Demonstração
                                </motion.button>
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

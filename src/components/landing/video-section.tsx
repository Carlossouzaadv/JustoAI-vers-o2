'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '../../components/ui/button';
import { Play, Clock, MessageSquare, FileText, ArrowRight } from 'lucide-react';

interface VideoSectionProps {
    className?: string;
    embedded?: boolean;
}

export function VideoSection({ className = '', embedded = false }: VideoSectionProps) {
    return (
        <section className={`py-20 ${embedded ? '' : 'bg-gray-50 border-y border-gray-100'} ${className}`}>
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                {!embedded && (
                    <div className="text-center max-w-3xl mx-auto mb-12">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6 }}
                        >
                            <h2 className="font-display font-bold text-3xl sm:text-4xl text-gray-900 mb-4">
                                Veja o JustoAI em Ação
                            </h2>
                            <p className="text-xl text-gray-600">
                                3 minutos para entender como economizar 20 horas por semana
                            </p>
                        </motion.div>
                    </div>
                )}

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="relative max-w-5xl mx-auto"
                >
                    {/* Video Placeholder Container */}
                    <div className="group relative aspect-video rounded-2xl overflow-hidden shadow-2xl bg-gray-900 ring-1 ring-gray-200">
                        {/* Thumbnail Image */}
                        <Image
                            src="/dashboard-preview.svg"
                            alt="JustoAI Dashboard Interface"
                            fill
                            className="object-cover opacity-90 transition-opacity duration-300 group-hover:opacity-40"
                            priority
                        />

                        {/* Default State: Play Button */}
                        <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-300 group-hover:opacity-0">
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center ring-1 ring-white/50 shadow-xl transition-transform duration-300 hover:scale-110">
                                    <Play className="w-8 h-8 text-white fill-white ml-1" />
                                </div>
                                <span className="text-white font-medium text-lg drop-shadow-md">
                                    Ver Demo (3 min)
                                </span>
                            </div>
                        </div>

                        {/* Hover State: CTA Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-gray-900/60 backdrop-blur-[2px]">
                            <div className="text-center p-8 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                <h3 className="text-white font-bold text-2xl mb-3">
                                    Vídeo em produção! 🎥
                                </h3>
                                <p className="text-gray-200 mb-8 max-w-md mx-auto">
                                    Enquanto finalizamos nossa demonstração em vídeo, que tal ver o JustoAI funcionando especificamente para o seu escritório?
                                </p>
                                <Link href="/demo">
                                    <Button size="lg" className="bg-white text-gray-900 hover:bg-gray-100 font-semibold text-lg px-8 shadow-xl">
                                        Agendar Demo Personalizada
                                        <ArrowRight className="w-5 h-5 ml-2" />
                                    </Button>
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Highlights */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
                        {[
                            {
                                icon: Clock,
                                title: 'Setup Rápido',
                                description: 'Configure sua conta e comece a usar em menos de 5 minutos.'
                            },
                            {
                                icon: MessageSquare,
                                title: 'Linguagem Executiva',
                                description: 'IA treinada para gerar análises claras e objetivas em linguagem simples.'
                            },
                            {
                                icon: FileText,
                                title: 'Relatórios Automáticos',
                                description: 'Envie relatórios de progresso direto para o WhatsApp dos clientes.'
                            }
                        ].map((item, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.6, delay: 0.4 + (index * 0.1) }}
                                className="flex flex-col items-center text-center p-6 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4 text-blue-600">
                                    <item.icon className="w-6 h-6" />
                                </div>
                                <h3 className="font-semibold text-gray-900 text-lg mb-2">
                                    {item.title}
                                </h3>
                                <p className="text-gray-600 text-sm">
                                    {item.description}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

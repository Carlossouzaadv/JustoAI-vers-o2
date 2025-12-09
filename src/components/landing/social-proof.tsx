'use client';

import { motion } from 'framer-motion';

const stats = [
    {
        value: '5 min',
        label: 'Para configurar e começar',
    },
    {
        value: '7 dias',
        label: 'Teste grátis, sem cartão',
    },
    {
        value: '24/7',
        label: 'Monitoramento automático',
    },
    {
        value: '98%',
        label: 'Taxa de entrega bem-sucedida',
    },
];

export function SocialProof() {
    return (
        <section className="bg-gray-50 border-y border-gray-200 py-8 relative overflow-hidden">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    {stats.map((stat, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.1, duration: 0.5 }}
                            className="text-center"
                        >
                            <div className="text-3xl sm:text-4xl font-bold text-accent-600 mb-1">
                                {stat.value}
                            </div>
                            <div className="text-sm sm:text-base text-gray-600 font-medium">
                                {stat.label}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

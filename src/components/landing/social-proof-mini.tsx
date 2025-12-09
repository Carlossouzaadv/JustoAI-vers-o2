'use client';

import React from 'react';
import { motion } from 'framer-motion';


export function SocialProofMini() {
    const stats = [
        {
            value: '98%',
            label: 'Taxa de satisfação',
            color: 'text-accent-600'
        },
        {
            value: '5 min',
            label: 'Setup médio',
            color: 'text-accent-600'
        },
        {
            value: '24/7',
            label: 'Monitoramento',
            color: 'text-accent-600'
        },
        {
            value: '7 dias',
            label: 'Trial grátis',
            color: 'text-accent-600'
        }
    ];

    return (
        <section className="py-12 bg-white border-y border-neutral-100">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {stats.map((stat, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            className="text-center"
                        >
                            <div className={`text-3xl font-bold mb-1 ${stat.color}`}>
                                {stat.value}
                            </div>
                            <div className="text-sm text-neutral-600 font-medium">
                                {stat.label}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

'use client';

import { Card } from '@/components/ui/card';
import { InlineSvgIcon } from '@/components/ui/custom-icon';
import { motion } from 'framer-motion';
import Link from 'next/link';

export function ActionGrid() {
    const actions = [
        {
            title: 'Analisar Novo Processo',
            description: 'Upload de PDF ou foto',
            icon: 'upload' as const,
            href: '/dashboard/documents-upload',
            color: 'bg-primary-50 text-primary-600',
            borderColor: 'border-primary-100',
            hoverColor: 'hover:border-primary-300',
            large: true
        },
        {
            title: 'Novo Cliente',
            description: 'Cadastrar ficha',
            icon: 'cliente' as const,
            href: '/dashboard/clients',
            color: 'bg-blue-50 text-blue-600',
            borderColor: 'border-blue-100',
            hoverColor: 'hover:border-blue-300',
            large: false
        },
        {
            title: 'Relatórios',
            description: 'Ver gerados',
            icon: 'documentos' as const,
            href: '/dashboard/reports',
            color: 'bg-indigo-50 text-indigo-600',
            borderColor: 'border-indigo-100',
            hoverColor: 'hover:border-indigo-300',
            large: false
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {actions.map((action, index) => (
                <Link href={action.href} key={index} className={action.large ? 'md:col-span-2' : ''}>
                    <motion.div
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                        whileTap={{ scale: 0.98 }}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * index }}
                    >
                        <Card className={`h-full p-6 cursor-pointer border-2 transition-all duration-200 ${action.borderColor} ${action.hoverColor} shadow-sm hover:shadow-md group`}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-display font-bold text-lg text-slate-800 mb-1 group-hover:text-primary-700 transition-colors">{action.title}</h3>
                                    <p className="text-slate-500 text-sm">{action.description}</p>
                                </div>
                                <div className={`p-3 rounded-2xl ${action.color} group-hover:scale-110 transition-transform duration-300`}>
                                    <InlineSvgIcon name={action.icon} size={action.large ? 32 : 24} />
                                </div>
                            </div>
                        </Card>
                    </motion.div>
                </Link>
            ))}
        </div>
    );
}

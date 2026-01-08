'use client';

import { Card } from '@/components/ui/card';
import { InlineSvgIcon } from '@/components/ui/custom-icon';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

export interface PriorityItem {
    id: string;
    type: 'error' | 'pending' | 'review';
    title: string;
    description: string;
    actionLabel: string;
    actionHref: string;
}

interface PriorityInboxProps {
    items: PriorityItem[];
}

export function PriorityInbox({ items }: PriorityInboxProps) {
    return (
        <Card className="bg-white border-slate-200 shadow-sm overflow-hidden mb-8">
            <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-font-display font-bold text-slate-800 flex items-center gap-2">
                    <InlineSvgIcon name="atencao" size={20} className="text-amber-500" />
                    Lista de Foco
                </h3>
                {items.length > 0 && (
                    <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-full">{items.length} pendências</span>
                )}
            </div>

            {items.length === 0 ? (
                <div className="p-8 text-center bg-white">
                    <div className="inline-flex p-4 rounded-full bg-green-50 mb-4">
                        <InlineSvgIcon name="success" size={48} className="text-green-500" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-800 mb-1">Inbox Zero!</h4>
                    <p className="text-slate-500">Você está em dia com todas as pendências críticas.</p>
                </div>
            ) : (
                <div className="divide-y divide-slate-100 bg-white">
                    <AnimatePresence>
                        {items.map(item => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors group"
                            >
                                <div className="flex gap-4 items-start">
                                    <div className="mt-1 flex-shrink-0">
                                        {item.type === 'error' && <InlineSvgIcon name="error" size={24} className="text-red-500" />}
                                        {item.type === 'pending' && <InlineSvgIcon name="atencao" size={24} className="text-amber-500" />}
                                        {item.type === 'review' && <InlineSvgIcon name="documentos" size={24} className="text-blue-500" />}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 group-hover:text-primary-700 transition-colors">{item.title}</h4>
                                        <p className="text-sm text-slate-500">{item.description}</p>
                                    </div>
                                </div>
                                <div className="flex-shrink-0 ml-10 sm:ml-0">
                                    <Link href={item.actionHref}>
                                        <Button size="sm" className="bg-white border border-slate-200 text-slate-600 hover:text-primary-600 hover:border-primary-200 hover:bg-primary-50 shadow-sm">
                                            {item.actionLabel}
                                        </Button>
                                    </Link>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}
        </Card>
    );
}

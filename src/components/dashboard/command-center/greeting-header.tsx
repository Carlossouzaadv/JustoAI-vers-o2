'use client';

import { motion } from 'framer-motion';
import { InlineSvgIcon } from '@/components/ui/custom-icon';

interface GreetingHeaderProps {
    userName: string;
    totalMonitored: number;
    urgentCount: number;
}

export function GreetingHeader({ userName, totalMonitored, urgentCount }: GreetingHeaderProps) {
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Bom dia';
        if (hour < 18) return 'Boa tarde';
        return 'Boa noite';
    };

    return (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <h1 className="text-3xl md:text-4xl font-display font-bold text-slate-800 tracking-tight">
                    {getGreeting()}, <span className="text-primary-600">{userName}</span>
                </h1>
                <p className="text-slate-500 mt-2 flex items-center gap-2 text-base">
                    {urgentCount > 0 ? (
                        <>
                            <InlineSvgIcon name="atencao" size={18} className="text-red-500" />
                            <span className="text-red-600 font-medium">Atenção: {urgentCount} prazos urgentes identificados.</span>
                        </>
                    ) : (
                        <>
                            <InlineSvgIcon name="success" size={18} className="text-green-500" />
                            <span>Tudo tranquilo. Nenhum prazo urgente para hoje.</span>
                        </>
                    )}
                </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="flex items-center gap-4 bg-white px-5 py-3 rounded-2xl shadow-sm border border-slate-100"
            >
                <div className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </div>
                <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Monitoramento IA</div>
                    <div className="text-sm font-bold text-slate-800 leading-none">
                        {totalMonitored} <span className="font-normal text-slate-500">processos ativos</span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InlineSvgIcon } from '@/components/ui/custom-icon';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface Process {
    id: string;
    name: string;
    client: string;
    deadline: string;
    priority: 'high' | 'medium' | 'low';
}

interface DeadlineRadarProps {
    processes: Process[];
}

export function DeadlineRadar({ processes }: DeadlineRadarProps) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [selectedDate, setSelectedDate] = useState<Date>(today);

    // Generate next 7 days
    const next7Days = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        return d;
    });

    const getDayStatus = (date: Date) => {
        const dayProcesses = processes.filter(p => {
            const d = new Date(p.deadline);
            d.setHours(0, 0, 0, 0);
            return d.getTime() === date.getTime();
        });

        if (dayProcesses.length === 0) return 'safe';
        const hasHighPriority = dayProcesses.some(p => p.priority === 'high');
        return hasHighPriority ? 'urgent' : 'warning';
    };

    const getProcessesForDate = (date: Date) => {
        return processes.filter(p => {
            const d = new Date(p.deadline);
            d.setHours(0, 0, 0, 0);
            return d.getTime() === date.getTime();
        });
    };

    const currentProcesses = getProcessesForDate(selectedDate);
    const isToday = selectedDate.getTime() === today.getTime();

    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0 pb-4">
                <CardTitle className="flex items-center gap-2 text-xl text-slate-800">
                    <InlineSvgIcon name="calendario" size={24} className="text-primary-600" />
                    Radar de Prazos <span className="text-slate-400 font-normal text-base ml-2">Próximos 7 dias</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
                {/* Timeline Strip */}
                <div className="flex justify-between gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                    {next7Days.map((date, index) => {
                        const status = getDayStatus(date);
                        const isSelected = date.getTime() === selectedDate.getTime();
                        const dayName = date.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3);
                        const dayNum = date.getDate();

                        let statusColor = 'bg-emerald-400';
                        if (status === 'urgent') statusColor = 'bg-red-500';
                        if (status === 'warning') statusColor = 'bg-yellow-400';

                        return (
                            <motion.button
                                key={index}
                                onClick={() => setSelectedDate(date)}
                                whileHover={{ y: -2 }}
                                whileTap={{ scale: 0.95 }}
                                className={`
                  flex flex-col items-center justify-between p-3 rounded-2xl min-w-[70px] h-[90px] transition-all duration-200 border-2
                  ${isSelected
                                        ? 'bg-white border-primary-500 shadow-md transform scale-105'
                                        : 'bg-white/60 border-transparent hover:bg-white hover:shadow-sm'
                                    }
                `}
                            >
                                <span className={`text-xs uppercase font-bold ${isSelected ? 'text-primary-600' : 'text-slate-400'}`}>
                                    {index === 0 ? 'HOJE' : dayName}
                                </span>
                                <span className={`text-2xl font-display font-bold ${isSelected ? 'text-slate-800' : 'text-slate-600'}`}>
                                    {dayNum}
                                </span>
                                <div className={`w-2 h-2 rounded-full ${statusColor}`} />
                            </motion.button>
                        );
                    })}
                </div>

                {/* Selected Day Details */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={selectedDate.toISOString()}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg text-slate-800">
                                {isToday ? 'Prazos de Hoje' : `Prazos de ${selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric' })}`}
                            </h3>
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                                {currentProcesses.length} processos
                            </Badge>
                        </div>

                        {currentProcesses.length === 0 ? (
                            <div className="text-center py-8">
                                <div className="inline-flex p-3 rounded-full bg-emerald-50 mb-3">
                                    <InlineSvgIcon name="success" size={32} className="text-emerald-500" />
                                </div>
                                <p className="text-slate-600 font-medium">Dia tranquilo!</p>
                                <p className="text-slate-400 text-sm">Nenhum prazo fatal para esta data.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {currentProcesses.map(process => (
                                    <div key={process.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors group cursor-pointer" onClick={() => window.location.href = `/dashboard/process/${process.id}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-1.5 h-12 rounded-full ${process.priority === 'high' ? 'bg-red-500' : 'bg-yellow-400'}`}></div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 group-hover:text-primary-700">{process.name}</h4>
                                                <p className="text-sm text-slate-500">{process.client}</p>
                                            </div>
                                        </div>
                                        <Button size="sm" variant="ghost" className="text-primary-600 hover:text-primary-700 hover:bg-primary-50">
                                            Ver detalhes →
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
            </CardContent>
        </Card>
    );
}

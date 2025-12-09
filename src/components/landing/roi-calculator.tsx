'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Slider } from '../ui/slider';
import { Button } from '../ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Clock, Rocket, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export function ROICalculator() {
    const [weeklyHours, setWeeklyHours] = useState(20);
    const [hourlyRate, setHourlyRate] = useState('400');
    const [showConfetti, setShowConfetti] = useState(false);

    // Trigger animation when calculation changes significantly
    useEffect(() => {
        setShowConfetti(true);
        const timer = setTimeout(() => setShowConfetti(false), 1000);
        return () => clearTimeout(timer);
    }, [weeklyHours, hourlyRate]);

    const { annualSavings, annualHours, paybackDays, roiMultiplier } = useMemo(() => {
        const rate = parseInt(hourlyRate);
        const weeklySav = weeklyHours * rate;
        const annualSav = weeklySav * 52;
        const annualHrs = weeklyHours * 52;

        const monthlyPlanCost = 497;
        const annualPlanCost = monthlyPlanCost * 12;

        // ROI Multiplier: (Total Savings - Total Cost) / Total Cost
        // Simplified view: Total Savings / Total Cost ("64x ROI")
        const multiplier = Math.floor(annualSav / annualPlanCost);

        const dailySav = weeklySav / 5; // approx work days
        const paybackInDays = Math.ceil(monthlyPlanCost / (dailySav || 1));

        return {
            annualSavings: annualSav,
            annualHours: annualHrs,
            paybackDays: paybackInDays,
            roiMultiplier: multiplier
        };
    }, [weeklyHours, hourlyRate]);

    return (
        <section className="bg-gradient-to-br from-primary-50 to-accent-50 py-24 overflow-hidden relative">
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-accent-100 rounded-full blur-3xl opacity-20 translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary-100 rounded-full blur-3xl opacity-20 -translate-x-1/2 translate-y-1/2"></div>

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center mb-16">
                    <Badge variant="secondary" className="mb-4 bg-accent-100 text-accent-700 hover:bg-accent-200 border-accent-200 shadow-sm">
                        Calculadora de ROI
                    </Badge>
                    <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-primary-800 mb-6">
                        Advogados estão economizando até <br />
                        <span className="bg-gradient-to-r from-accent-600 to-accent-500 bg-clip-text text-transparent">
                            R$ 400K por ano
                        </span>
                    </h2>
                    <p className="text-lg text-neutral-700 max-w-2xl mx-auto">
                        Calcule quanto <strong>seu escritório</strong> vai economizar automatizando a criação de relatórios processuais.
                    </p>
                </div>

                <div className="max-w-6xl mx-auto">
                    <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">

                        {/* Left Column: Inputs & Logic */}
                        <div className="lg:col-span-5 space-y-8">
                            <Card className="p-8 bg-white/80 backdrop-blur-sm border-white/50 shadow-xl rounded-2xl">
                                <div className="space-y-8">
                                    {/* Hours Slider */}
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-sm font-bold text-primary-800 flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-accent-500" />
                                                Horas/semana em relatórios
                                            </label>
                                            <span className="text-accent-700 font-bold bg-accent-50 px-4 py-1.5 rounded-full text-sm border border-accent-100">
                                                {weeklyHours}h
                                            </span>
                                        </div>
                                        <Slider
                                            defaultValue={[20]}
                                            max={60}
                                            min={5}
                                            step={1}
                                            value={[weeklyHours]}
                                            onValueChange={(value) => setWeeklyHours(value[0])}
                                            className="py-4 cursor-pointer"
                                        />
                                        <div className="flex justify-between text-xs text-neutral-400 font-medium px-1">
                                            <span>5h</span>
                                            <span>Média (20h)</span>
                                            <span>60h</span>
                                        </div>
                                    </div>

                                    <hr className="border-neutral-100" />

                                    {/* Hourly Rate Select */}
                                    <div className="space-y-4">
                                        <label className="text-sm font-bold text-primary-800 flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-accent-500" />
                                            Valor médio da sua hora
                                        </label>
                                        <Select value={hourlyRate} onValueChange={setHourlyRate}>
                                            <SelectTrigger className="w-full h-14 text-base bg-white border-neutral-200 focus:ring-accent-500 rounded-xl">
                                                <SelectValue placeholder="Selecione o valor" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="150">R$ 150/h (Júnior)</SelectItem>
                                                <SelectItem value="250">R$ 250/h (Pleno)</SelectItem>
                                                <SelectItem value="400">R$ 400/h (Sênior)</SelectItem>
                                                <SelectItem value="800">R$ 800/h (Sócio)</SelectItem>
                                                <SelectItem value="1500">R$ 1.500/h (Partner)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Peer Comparison Section */}
                                    <div className="bg-neutral-50 rounded-xl p-6 border border-neutral-200 mt-8">
                                        <h4 className="text-sm font-semibold text-primary-900 mb-4 flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4 text-primary-500" />
                                            Como você se compara?
                                        </h4>

                                        <div className="relative h-4 bg-neutral-200 rounded-full mb-2 overflow-visible">
                                            {/* Average Marker */}
                                            <div className="absolute top-0 bottom-0 left-1/3 w-1 bg-neutral-400 z-10 opacity-30"></div>
                                            <div className="absolute -top-7 left-1/3 -translate-x-1/2 text-[10px] font-bold text-neutral-500 uppercase tracking-wide">
                                                Média (20h)
                                            </div>

                                            {/* User Bar */}
                                            <motion.div
                                                className="absolute top-0 bottom-0 left-0 bg-accent-500 rounded-full"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(weeklyHours / 60) * 100}%` }}
                                                transition={{ duration: 0.5, ease: 'easeOut' }}
                                            />
                                        </div>
                                        <p className="text-xs text-neutral-600 mt-3 leading-relaxed">
                                            {weeklyHours > 20
                                                ? <span className="text-amber-600 font-semibold">Cuidado: Você gasta {(weeklyHours - 20)}h a mais que a média.</span>
                                                : <span className="text-green-600 font-semibold">Bom: Você está abaixo da média, mas ainda pode zerar isso.</span>
                                            }
                                        </p>
                                    </div>
                                </div>
                            </Card>

                            {/* Methodology Note */}
                            <div className="bg-white/50 border border-neutral-200 rounded-xl p-6">
                                <h4 className="text-xs font-bold text-primary-900 mb-3 uppercase tracking-wider flex items-center gap-2">
                                    💡 Metodologia de Cálculo
                                </h4>
                                <ul className="text-xs text-neutral-600 space-y-2">
                                    <li className="flex items-start gap-2">
                                        <span className="text-accent-500 font-bold">•</span>
                                        <span><strong>Leitura de processos:</strong> De 2h para 5min (IA)</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-accent-500 font-bold">•</span>
                                        <span><strong>Criação de relatórios:</strong> De 1h para Instantâneo</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-accent-500 font-bold">•</span>
                                        <span><strong>Envio aos clientes:</strong> De 30min para Automático</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Right Column: High Impact Result */}
                        <div className="lg:col-span-7">
                            <motion.div
                                className="bg-gradient-to-br from-accent-600 to-accent-700 rounded-3xl p-8 sm:p-12 text-white shadow-2xl relative overflow-hidden h-full flex flex-col justify-between"
                                animate={showConfetti ? { scale: [1, 1.02, 1] } : {}}
                                transition={{ duration: 0.3 }}
                            >
                                {/* Results Header */}
                                <div className="text-center relative z-10 mb-8">
                                    <p className="text-accent-100 text-sm font-bold uppercase tracking-widest mb-4">
                                        Sua Economia Projetada
                                    </p>
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={annualSavings}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="font-display font-bold text-5xl sm:text-7xl mb-4"
                                        >
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(annualSavings)}
                                        </motion.div>
                                    </AnimatePresence>
                                    <div className="inline-block bg-white/10 backdrop-blur-md rounded-lg px-4 py-2 text-accent-50 border border-white/10">
                                        + R$ {new Intl.NumberFormat('pt-BR', { style: 'decimal', maximumFractionDigits: 0 }).format(annualSavings / 12)} por mês no caixa
                                    </div>
                                </div>

                                {/* Breakdown Grid */}
                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10 hover:bg-white/15 transition-colors">
                                        <Clock className="w-8 h-8 text-accent-200 mb-3" />
                                        <div className="text-3xl font-bold mb-1">{annualHours}h</div>
                                        <div className="text-xs text-accent-100 uppercase font-semibold">Horas Recuperadas/ano</div>
                                    </div>
                                    <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10 hover:bg-white/15 transition-colors">
                                        <TrendingUp className="w-8 h-8 text-green-300 mb-3" />
                                        <div className="text-3xl font-bold mb-1 text-green-300">{roiMultiplier}x</div>
                                        <div className="text-xs text-accent-100 uppercase font-semibold">Retorno sobre Investimento</div>
                                    </div>
                                </div>

                                {/* Payback & CTA */}
                                <div className="bg-primary-900/30 rounded-2xl p-6 border border-white/5 backdrop-blur-sm">
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/30">
                                                <Rocket className="w-6 h-6 text-green-400" />
                                            </div>
                                            <div>
                                                <div className="text-sm text-accent-100">Payback estimado em</div>
                                                <div className="text-xl font-bold text-white">
                                                    Apenas {paybackDays} dia{paybackDays > 1 ? 's' : ''}
                                                </div>
                                            </div>
                                        </div>
                                        <Link href="/signup" className="w-full sm:w-auto">
                                            <Button className="w-full bg-white text-accent-700 hover:bg-neutral-100 font-bold py-6 px-8 text-lg shadow-lg hover:shadow-xl transition-all">
                                                Testar Grátis por 7 Dias →
                                            </Button>
                                        </Link>
                                    </div>
                                    <div className="flex items-center justify-center gap-4 mt-4 text-xs text-accent-200/80">
                                        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Sem cartão necessário</span>
                                        <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Cancele quando quiser</span>
                                    </div>
                                </div>

                                {/* Background Effects */}
                                <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                                    <div className="absolute -top-32 -right-32 w-80 h-80 bg-accent-400 rounded-full mix-blend-overlay filter blur-3xl opacity-30"></div>
                                    <div className="absolute -bottom-32 -left-32 w-80 h-80 bg-primary-500 rounded-full mix-blend-overlay filter blur-3xl opacity-30"></div>
                                </div>
                            </motion.div>
                        </div>

                    </div>
                </div>
            </div>
        </section>
    );
}

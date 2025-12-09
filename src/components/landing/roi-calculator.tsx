'use client';

import React, { useState, useMemo } from 'react';
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

export function ROICalculator() {
    const [weeklyHours, setWeeklyHours] = useState(20);
    const [hourlyRate, setHourlyRate] = useState('400');

    const { annualSavings, annualHours, paybackMonths, weeklySavings } = useMemo(() => {
        const rate = parseInt(hourlyRate);
        const weeklySav = weeklyHours * rate;
        const annualSav = weeklySav * 52;
        const annualHrs = weeklyHours * 52;

        // Monthly Plan Cost for "Gestão"
        const monthlyPlanCost = 497;
        // Monthly Savings (approx 4.33 weeks per month)
        const monthlySav = weeklySav * 4.33;

        // Avoid division by zero
        const payback = monthlySav > 0 ? Math.ceil((monthlyPlanCost / monthlySav) * 30) : 0; // standardizing to days for better precision if needed, but keeping months as requested

        // Reverting to months logic but potentially fractional
        const paybackInMonths = monthlySav > 0 ? monthlyPlanCost / monthlySav : 0;

        // Formatting logical text for payback
        const paybackText = paybackInMonths < 1
            ? `${Math.ceil(paybackInMonths * 30)} dias`
            : `${Math.ceil(paybackInMonths)} meses`;

        return {
            annualSavings: annualSav,
            annualHours: annualHrs,
            paybackMonths: paybackText,
            weeklySavings: weeklySav
        };
    }, [weeklyHours, hourlyRate]);

    return (
        <section className="bg-gradient-to-br from-primary-50 to-accent-50 py-20 overflow-hidden relative">
            {/* Decorative Elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent-100 rounded-full blur-3xl opacity-30 translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary-100 rounded-full blur-3xl opacity-30 -translate-x-1/2 translate-y-1/2"></div>

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="text-center mb-12">
                    <Badge variant="secondary" className="mb-4 bg-white text-primary-700 border-primary-200 shadow-sm">
                        Calculadora de ROI
                    </Badge>
                    <h2 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-primary-800 mb-6 transition-all">
                        Calcule Quanto Você Vai Economizar
                    </h2>
                    <p className="text-lg text-neutral-700 max-w-2xl mx-auto">
                        Veja o impacto real do JustoAI no seu escritório. Simule seus ganhos abaixo.
                    </p>
                </div>

                <div className="max-w-5xl mx-auto">
                    <Card className="p-8 lg:p-10 bg-white/80 backdrop-blur-sm border-white/50 shadow-xl rounded-2xl">
                        <div className="grid lg:grid-cols-2 gap-12 items-center">

                            {/* Inputs Section */}
                            <div className="space-y-8">
                                {/* Hours Slider */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-sm font-semibold text-primary-800">
                                            Horas gastas por semana em relatórios
                                        </label>
                                        <span className="text-accent-600 font-bold bg-accent-50 px-3 py-1 rounded-full text-sm">
                                            {weeklyHours}h/semana
                                        </span>
                                    </div>
                                    <Slider
                                        defaultValue={[20]}
                                        max={40}
                                        min={5}
                                        step={1}
                                        value={[weeklyHours]}
                                        onValueChange={(value) => setWeeklyHours(value[0])}
                                        className="py-2"
                                    />
                                    <div className="flex justify-between text-xs text-neutral-500 px-1">
                                        <span>5h</span>
                                        <span>20h</span>
                                        <span>40h</span>
                                    </div>
                                </div>

                                {/* Hourly Rate Select */}
                                <div className="space-y-4">
                                    <label className="text-sm font-semibold text-primary-800 block">
                                        Qual o valor médio da sua hora?
                                    </label>
                                    <Select value={hourlyRate} onValueChange={setHourlyRate}>
                                        <SelectTrigger className="w-full h-12 text-base bg-white border-neutral-300 focus:ring-accent-500">
                                            <SelectValue placeholder="Selecione o valor" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="200">R$ 200/h (Iniciante)</SelectItem>
                                            <SelectItem value="400">R$ 400/h (Pleno)</SelectItem>
                                            <SelectItem value="800">R$ 800/h (Sênior)</SelectItem>
                                            <SelectItem value="1500">R$ 1.500/h (Sócio)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Info Note */}
                                <div className="bg-primary-50 rounded-lg p-4 text-sm text-primary-800 flex gap-3 items-start">
                                    <span className="text-lg">💡</span>
                                    <p>
                                        Consideramos que o JustoAI automatiza <strong>90% desse trabalho</strong>, permitindo que você foque em atividades billable ou estratégicas.
                                    </p>
                                </div>
                            </div>

                            {/* Results Section */}
                            <div className="bg-gradient-to-br from-primary-900 to-primary-800 rounded-xl p-8 text-white shadow-2xl relative overflow-hidden group">
                                {/* Background glow animation */}
                                <div className="absolute top-0 right-0 w-64 h-64 bg-accent-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-accent-500/30 transition-all duration-700"></div>

                                <h3 className="text-xl font-semibold mb-6 opacity-90 relative z-10">
                                    Sua Economia Projetada
                                </h3>

                                <div className="space-y-6 relative z-10">
                                    {/* Annual Savings */}
                                    <div className="space-y-1">
                                        <div className="text-sm text-primary-200">Economia Anual Estimada</div>
                                        <AnimatePresence mode="wait">
                                            <motion.div
                                                key={annualSavings}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                transition={{ duration: 0.3 }}
                                                className="text-4xl sm:text-5xl font-bold text-white tracking-tight"
                                            >
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(annualSavings)}
                                            </motion.div>
                                        </AnimatePresence>
                                        <div className="text-xs text-accent-300 font-medium">
                                            + R$ {new Intl.NumberFormat('pt-BR', { style: 'decimal', maximumFractionDigits: 0 }).format(weeklySavings)} por semana
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-primary-700/50">
                                        {/* Hours Saved */}
                                        <div>
                                            <div className="text-sm text-primary-200 mb-1">Horas Recuperadas</div>
                                            <AnimatePresence mode="wait">
                                                <motion.div
                                                    key={annualHours}
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="flex items-center gap-2"
                                                >
                                                    <span className="text-2xl font-bold hover:text-accent-300 transition-colors">
                                                        {annualHours}h
                                                    </span>
                                                    <span className="text-xs bg-white/10 px-2 py-0.5 rounded text-white/80">/ano</span>
                                                </motion.div>
                                            </AnimatePresence>
                                        </div>

                                        {/* Payback */}
                                        <div>
                                            <div className="text-sm text-primary-200 mb-1">Payback Estimado</div>
                                            <AnimatePresence mode="wait">
                                                <motion.div
                                                    key={paybackMonths}
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="flex items-center gap-2"
                                                >
                                                    <span className="text-2xl font-bold text-accent-400">
                                                        {paybackMonths}
                                                    </span>
                                                </motion.div>
                                            </AnimatePresence>
                                        </div>
                                    </div>

                                    <div className="pt-6">
                                        <Button className="w-full bg-accent-500 hover:bg-accent-600 text-white font-bold py-6 text-lg shadow-lg hover:shadow-accent-500/20 transition-all duration-300 transform hover:-translate-y-1">
                                            Começar a Economizar Agora
                                        </Button>
                                        <p className="text-xs text-center text-primary-300 mt-3">
                                            Baseado no plano Gestão (R$ 497/mês)
                                        </p>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </Card>
                </div>
            </div>
        </section>
    );
}

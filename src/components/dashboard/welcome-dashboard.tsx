'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Check, Upload, UserPlus, FileText, ArrowRight, Play, Sparkles } from 'lucide-react';
import confetti from 'canvas-confetti';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface WelcomeDashboardProps {
    userName: string;
    hasUploadedDocuments: boolean;
    hasCreatedClient: boolean;
    hasGeneratedReport: boolean;
    pendingCount?: number;
}

export function WelcomeDashboard({
    userName,
    hasUploadedDocuments,
    hasCreatedClient,
    hasGeneratedReport,
    pendingCount = 0
}: WelcomeDashboardProps) {
    const router = useRouter();

    // Calculate progress
    const steps = [
        {
            id: 'upload',
            label: 'Analise seu primeiro processo',
            completed: hasUploadedDocuments || pendingCount > 0,
            icon: Upload,
            action: () => router.push('/dashboard/documents/upload'),
            description: 'Faça upload de um PDF para análise automática.'
        },
        {
            id: 'client',
            label: 'Cadastre um cliente',
            completed: hasCreatedClient,
            icon: UserPlus,
            action: () => router.push('/dashboard/clients'),
            description: 'Organize seus processos por cliente.'
        },
        {
            id: 'report',
            label: 'Gere um relatório',
            completed: hasGeneratedReport,
            icon: FileText,
            action: () => router.push('/dashboard/reports'), // Assuming route
            description: 'Crie documentos profissionais em segundos.'
        }
    ];

    const completedSteps = steps.filter(s => s.completed).length;
    const progress = (completedSteps / steps.length) * 100;

    // Trigger confetti if all steps completed (could also be triggered on mount if just finished)
    if (completedSteps === steps.length) {
        // Optional: trigger confetti once? 
    }

    const handleStartTour = () => {
        // Reset tour state if needed logic exists, otherwise just reload or set param
        localStorage.removeItem('dashboard-tour-completed');
        window.location.reload();
    };

    return (
        <div className="space-y-8 max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">

            {/* Hero Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">
                        Olá, {userName}! 👋
                    </h1>
                    <p className="text-slate-600 text-lg">
                        Seu escritório digital está pronto. Vamos começar a transformar sua advocacia?
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={handleStartTour} className="gap-2">
                        <Play size={16} />
                        Tour guiado
                    </Button>
                    <Button
                        className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-lg shadow-indigo-200"
                        onClick={() => router.push('/dashboard/documents/upload')}
                    >
                        <Sparkles size={16} />
                        Novo Processo
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Checklist */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="p-6 border-slate-200 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-slate-100">
                            <motion.div
                                className="h-full bg-indigo-600"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 1 }}
                            />
                        </div>

                        <div className="mb-6 mt-2">
                            <h2 className="text-xl font-semibold text-slate-900 mb-1">Seus primeiros passos</h2>
                            <p className="text-slate-500 text-sm">
                                Complete estas ações para dominar o JustoAI ({completedSteps}/{steps.length})
                            </p>
                        </div>

                        <div className="space-y-4">
                            {steps.map((step, index) => {
                                const isNext = !step.completed && (index === 0 || steps[index - 1].completed);

                                return (
                                    <motion.div
                                        key={step.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className={cn(
                                            'group p-4 rounded-xl border transition-all duration-200',
                                            step.completed
                                                ? 'bg-slate-50 border-slate-100 opacity-70 hover:opacity-100'
                                                : isNext
                                                    ? 'bg-white border-indigo-100 shadow-md ring-1 ring-indigo-50'
                                                    : 'bg-white border-slate-100 opacity-60'
                                        )}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={cn(
                                                'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                                                step.completed
                                                    ? 'bg-green-100 text-green-600'
                                                    : isNext
                                                        ? 'bg-indigo-100 text-indigo-600'
                                                        : 'bg-slate-100 text-slate-400'
                                            )}>
                                                {step.completed ? <Check size={20} /> : <step.icon size={20} />}
                                            </div>

                                            <div className="flex-1">
                                                <h3 className={cn(
                                                    'font-medium',
                                                    step.completed ? 'text-slate-700 decoration-slate-400' : 'text-slate-900'
                                                )}>
                                                    {step.label}
                                                </h3>
                                                <p className="text-sm text-slate-500">{step.description}</p>
                                            </div>

                                            <Button
                                                size="sm"
                                                variant={step.completed ? 'ghost' : (isNext ? 'default' : 'outline')}
                                                className={cn(
                                                    step.completed && 'text-green-600 hover:text-green-700',
                                                    isNext && 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                                )}
                                                onClick={() => {
                                                    if (step.completed) return;
                                                    step.action();
                                                }}
                                                disabled={!isNext && !step.completed}
                                            >
                                                {step.completed ? (
                                                    <span className="flex items-center gap-1 font-medium">
                                                        Concluído
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1">
                                                        Começar <ArrowRight size={14} />
                                                    </span>
                                                )}
                                            </Button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </Card>

                    {pendingCount > 0 && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                                    <span className="font-bold text-lg">!</span>
                                </div>
                                <div>
                                    <h3 className="font-medium text-amber-900">Processos Pendentes</h3>
                                    <p className="text-sm text-amber-700">Você tem {pendingCount} processos aguardando organização.</p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                className="border-amber-300 text-amber-800 hover:bg-amber-100"
                                onClick={() => router.push('/dashboard/clients')}
                            >
                                Organizar Agora
                            </Button>
                        </motion.div>
                    )}
                </div>

                {/* Sidebar Widgets - Preview Cards */}
                <div className="space-y-6">
                    <Card className="p-5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none shadow-lg">
                        <div className="mb-4">
                            <Sparkles className="w-8 h-8 opacity-80 mb-2" />
                            <h3 className="font-bold text-lg">Dica Pro</h3>
                            <p className="text-indigo-100 text-sm mt-1">
                                Use a busca semântica para encontrar jurisprudência relevante em segundos. Basta digitar sua tese.
                            </p>
                        </div>
                        <Button
                            size="sm"
                            className="w-full bg-white/10 hover:bg-white/20 border-0 text-white"
                            onClick={() => toast.info('Funcionalidade disponível no menu Jurisprudência')}
                        >
                            Saiba mais
                        </Button>
                    </Card>

                    <Card className="p-4">
                        <h3 className="font-semibold mb-3 text-slate-900">Precisa de ajuda?</h3>
                        <ul className="space-y-2 text-sm text-slate-600">
                            <li>
                                <a href="#" className="flex items-center gap-2 hover:text-indigo-600 transition-colors">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> WhatsApp Suporte
                                </a>
                            </li>
                            <li>
                                <a href="#" className="flex items-center gap-2 hover:text-indigo-600 transition-colors">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Central de Ajuda
                                </a>
                            </li>
                            <li>
                                <a href="#" className="flex items-center gap-2 hover:text-indigo-600 transition-colors">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Tutoriais em Vídeo
                                </a>
                            </li>
                        </ul>
                    </Card>
                </div>
            </div>
        </div>
    );
}

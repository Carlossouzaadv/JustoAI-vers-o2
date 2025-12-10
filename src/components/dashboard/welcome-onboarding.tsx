'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboarding } from '@/hooks/use-onboarding';
import { Progress } from '@/components/ui/progress';
import { Check, ChevronRight, User, Briefcase, Target, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

interface Props {
  userId?: string; // Optional now as we use generic auth check in component if needed, but prop is kept for compatibility
  onComplete?: () => void;
}

interface OnboardingData {
  fullName: string;
  role: string;
  firmName: string;
  practiceAreas: string[];
  experience: string;
  mainGoals: string[];
}

const STEPS = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao JustoAI',
    description: 'Sua jornada para advocacia de alta performance começa aqui.',
    icon: Rocket
  },
  {
    id: 'profile',
    title: 'Seu Perfil',
    description: 'Conte-nos um pouco sobre você.',
    icon: User
  },
  {
    id: 'goals',
    title: 'Seus Objetivos',
    description: 'O que você busca alcançar?',
    icon: Target
  }
];

export function WelcomeOnboarding({ userId, onComplete }: Props) {
  const { showOnboarding, completeOnboarding } = useOnboarding();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<OnboardingData>({
    fullName: '',
    role: '',
    firmName: '', // Kept for UI state but might not be persisted if not in schema yet
    practiceAreas: [],
    experience: '',
    mainGoals: []
  });

  // Sync internal state with hook visibility
  useEffect(() => {
    setIsOpen(showOnboarding);
  }, [showOnboarding]);

  const saveOnboarding = useMutation({
    mutationFn: async (data: OnboardingData) => {
      const response = await fetch('/api/users/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: data.fullName,
          role: data.role,
          practiceAreas: data.practiceAreas,
          mainGoals: data.mainGoals,
        }),
      });

      if (!response.ok) {
        throw new Error('Falha ao salvar onboarding');
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Perfil salvo com sucesso!');
      completeOnboarding();
      setIsOpen(false);
      if (onComplete) onComplete();
    },
    onError: (error) => {
      toast.error('Erro ao salvar. Tente novamente.');
      console.error(error);
    }
  });

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Validate before saving
      if (!formData.fullName || !formData.role) {
        toast.error('Por favor, preencha nome e cargo.');
        return;
      }
      saveOnboarding.mutate(formData);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const updateField = (field: keyof OnboardingData, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleSelection = (field: 'practiceAreas' | 'mainGoals', value: string) => {
    setFormData(prev => {
      const current = prev[field];
      const exists = current.includes(value);
      return {
        ...prev,
        [field]: exists
          ? current.filter(item => item !== value)
          : [...current, value]
      };
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      // Prevent closing if not completed (optional enforcement)
      if (!open && !saveOnboarding.isSuccess) {
        // Optionally confirm closing
      }
      setIsOpen(open);
    }}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-white dark:bg-slate-950 border-none shadow-2xl">
        <div className="flex h-[500px]">
          {/* Sidebar */}
          <div className="w-[200px] bg-slate-50 dark:bg-slate-900 p-6 flex flex-col border-r">
            <div className="mb-8">
              <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold mb-2">
                J
              </div>
              <span className="font-bold text-lg text-slate-900 dark:text-white">JustoAI</span>
            </div>

            <nav className="space-y-4 flex-1">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;

                return (
                  <div
                    key={step.id}
                    className={cn(
                      'flex items-center gap-3 text-sm transition-colors duration-200',
                      isActive ? 'text-indigo-600 font-medium' : 'text-slate-500',
                      isCompleted && 'text-green-600'
                    )}
                  >
                    <div className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center border transition-all',
                      isActive ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-200',
                      isCompleted ? 'border-green-600 bg-green-50 text-green-600' : ''
                    )}>
                      {isCompleted ? <Check size={14} /> : <Icon size={14} />}
                    </div>
                    <span className="hidden sm:inline">{step.id === 'welcome' ? 'Início' : step.title}</span>
                  </div>
                );
              })}
            </nav>

            <div className="text-xs text-slate-400">
              Passo {currentStep + 1} de {STEPS.length}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-8 flex flex-col overflow-y-auto">
            <div className="flex-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                      {STEPS[currentStep].title}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400">
                      {STEPS[currentStep].description}
                    </p>
                  </div>

                  {currentStep === 0 && (
                    <div className="space-y-6">
                      <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800">
                        <p className="text-indigo-800 dark:text-indigo-200 leading-relaxed">
                          Bem-vindo à nova era da advocacia. O JustoAI vai atuar como seu
                          parceiro estratégico, analisando processos e sugerindo ações inteligentes.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 border rounded-lg bg-white dark:bg-slate-900">
                          <h4 className="font-semibold mb-1">🔍 Análise Rápida</h4>
                          <p className="text-sm text-slate-500">Insights em segundos, não horas.</p>
                        </div>
                        <div className="p-4 border rounded-lg bg-white dark:bg-slate-900">
                          <h4 className="font-semibold mb-1">🤖 Assistente IA</h4>
                          <p className="text-sm text-slate-500">Seu copiloto jurídico 24/7.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 1 && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Nome Completo</Label>
                        <Input
                          placeholder="Ex: Dr. Carlos Silva"
                          value={formData.fullName}
                          onChange={(e) => updateField('fullName', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Seu Cargo Principal</Label>
                        <Input
                          placeholder="Ex: Sócio, Advogado Senior..."
                          value={formData.role}
                          onChange={(e) => updateField('role', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Áreas de Atuação</Label>
                        <div className="flex flex-wrap gap-2">
                          {['Civil', 'Trabalhista', 'Tributário', 'Família', 'Criminal'].map(area => (
                            <button
                              key={area}
                              onClick={() => toggleSelection('practiceAreas', area)}
                              className={cn(
                                'px-3 py-1 rounded-full text-sm border transition-colors',
                                formData.practiceAreas.includes(area)
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : 'text-slate-600 border-slate-200 hover:border-indigo-300'
                              )}
                            >
                              {area}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="space-y-6">
                      <Label>Quais são seus principais objetivos?</Label>
                      <div className="grid gap-3">
                        {[
                          'Ganhar tempo na análise de processos',
                          'Melhorar a qualidade das petições',
                          'Organizar prazos e agenda',
                          'Atrair mais clientes'
                        ].map(goal => (
                          <div
                            key={goal}
                            onClick={() => toggleSelection('mainGoals', goal)}
                            className={cn(
                              'p-3 rounded-lg border cursor-pointer transition-all flex items-center gap-3',
                              formData.mainGoals.includes(goal)
                                ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                                : 'border-slate-200 hover:border-indigo-300'
                            )}
                          >
                            <div className={cn(
                              'w-5 h-5 rounded border flex items-center justify-center',
                              formData.mainGoals.includes(goal)
                                ? 'bg-indigo-600 border-indigo-600'
                                : 'border-slate-300'
                            )}>
                              {formData.mainGoals.includes(goal) && <Check size={12} className="text-white" />}
                            </div>
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{goal}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer Actions */}
            <div className="pt-6 border-t flex justify-between items-center">
              <Button
                variant="ghost"
                onClick={handleBack}
                disabled={currentStep === 0}
                className={currentStep === 0 ? 'invisible' : ''}
              >
                Voltar
              </Button>
              <Button
                onClick={handleNext}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                disabled={saveOnboarding.isPending}
              >
                {saveOnboarding.isPending ? 'Salvando...' : (
                  currentStep === STEPS.length - 1 ? 'Começar Jornada' : 'Próximo'
                )}
                {!saveOnboarding.isPending && currentStep !== STEPS.length - 1 && <ChevronRight size={16} />}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
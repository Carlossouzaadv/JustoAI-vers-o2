'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ICONS } from '@/lib/icons';

interface WelcomeOnboardingProps {
  onComplete: () => void;
}

interface UserProfile {
  name: string;
  role: string;
  firmName: string;
  caseTypes: string[];
  experience: string;
  goals: string[];
}

export function WelcomeOnboarding({ onComplete }: WelcomeOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [profile, setProfile] = useState<UserProfile>({
    name: '',
    role: '',
    firmName: '',
    caseTypes: [],
    experience: '',
    goals: []
  });

  const steps = [
    {
      title: 'Bem-vindo ao JustoAI! 👋',
      subtitle: 'Vamos configurar seu workspace em alguns passos simples',
      component: <WelcomeStep profile={profile} setProfile={setProfile} />
    },
    {
      title: 'Conte-nos sobre você',
      subtitle: 'Essas informações nos ajudam a personalizar sua experiência',
      component: <ProfileStep profile={profile} setProfile={setProfile} />
    },
    {
      title: 'Quais são seus objetivos?',
      subtitle: 'Vamos focar no que mais importa para você',
      component: <GoalsStep profile={profile} setProfile={setProfile} />
    },
    {
      title: 'Como você quer começar?',
      subtitle: 'Escolha a melhor forma de começar a usar o JustoAI',
      component: <ActionStep profile={profile} onComplete={onComplete} />
    }
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Progress Bar */}
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{ICONS.ROCKET}</span>
              <span className="font-bold text-lg text-primary-800">Setup Inicial</span>
            </div>
            <span className="text-sm text-neutral-600">
              {currentStep + 1} de {steps.length}
            </span>
          </div>

          <div className="w-full bg-neutral-200 rounded-full h-2">
            <motion.div
              className="bg-gradient-to-r from-accent-500 to-primary-800 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <motion.div
            key={currentStep}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <h2 className="font-display font-bold text-2xl text-primary-800 mb-2">
              {steps[currentStep].title}
            </h2>
            <p className="text-neutral-600 mb-6">
              {steps[currentStep].subtitle}
            </p>

            {steps[currentStep].component}
          </motion.div>
        </div>

        {/* Navigation */}
        {currentStep < steps.length - 1 && (
          <div className="p-6 border-t border-neutral-200 flex justify-between">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 0}
            >
              {ICONS.ARROW_LEFT} Anterior
            </Button>
            <Button
              onClick={nextStep}
              className="bg-gradient-to-r from-accent-500 to-primary-800"
            >
              Próximo {ICONS.ARROW_RIGHT}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function WelcomeStep({ profile: _profile, setProfile: _setProfile }: { profile: UserProfile; setProfile: (_p: UserProfile) => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-6xl mb-4">🎉</div>
        <h3 className="text-xl font-semibold text-primary-800 mb-2">
          Que bom ter você aqui!
        </h3>
        <p className="text-neutral-600">
          O JustoAI vai transformar como você trabalha com processos jurídicos.
          Vamos começar configurando tudo para você.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl mb-2">{ICONS.BRAIN}</div>
          <div className="font-medium text-sm text-primary-800">Análise Automática</div>
          <div className="text-xs text-neutral-600">IA lê seus processos</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl mb-2">{ICONS.REPORT}</div>
          <div className="font-medium text-sm text-primary-800">Relatórios Automáticos</div>
          <div className="text-xs text-neutral-600">Para seus clientes</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl mb-2">{ICONS.TIME}</div>
          <div className="font-medium text-sm text-primary-800">Economize Tempo</div>
          <div className="text-xs text-neutral-600">20h por semana</div>
        </Card>
      </div>
    </div>
  );
}

function ProfileStep({ profile, setProfile }: { profile: UserProfile; setProfile: (_p: UserProfile) => void }) {
  const roles = [
    'Advogado(a) Autônomo(a)',
    'Sócio(a) de Escritório',
    'Advogado(a) Associado(a)',
    'Diretor(a) Jurídico(a)',
    'Estagiário(a)',
    'Outro'
  ];

  const caseTypes = [
    'Direito Civil',
    'Direito Trabalhista',
    'Direito Criminal',
    'Direito Empresarial',
    'Direito Família',
    'Direito Tributário',
    'Direito Administrativo',
    'Direito Previdenciário'
  ];

  const toggleCaseType = (type: string) => {
    const newTypes = profile.caseTypes.includes(type)
      ? profile.caseTypes.filter(t => t !== type)
      : [...profile.caseTypes, type];
    setProfile({ ...profile, caseTypes: newTypes });
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Seu nome
        </label>
        <Input
          placeholder="Como você gostaria de ser chamado?"
          value={profile.name}
          onChange={(e) => setProfile({ ...profile, name: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Nome do escritório/empresa
        </label>
        <Input
          placeholder="Nome da sua organização"
          value={profile.firmName}
          onChange={(e) => setProfile({ ...profile, firmName: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Sua função
        </label>
        <div className="grid grid-cols-2 gap-2">
          {roles.map((role) => (
            <Button
              key={role}
              variant={profile.role === role ? 'default' : 'outline'}
              className="text-sm"
              onClick={() => setProfile({ ...profile, role })}
            >
              {role}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Áreas de atuação (selecione todas que se aplicam)
        </label>
        <div className="grid grid-cols-2 gap-2">
          {caseTypes.map((type) => (
            <Button
              key={type}
              variant={profile.caseTypes.includes(type) ? 'default' : 'outline'}
              className="text-sm"
              onClick={() => toggleCaseType(type)}
            >
              {type}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

function GoalsStep({ profile, setProfile }: { profile: UserProfile; setProfile: (_p: UserProfile) => void }) {
  const goals = [
    {
      id: 'time',
      title: 'Economizar tempo',
      description: 'Automatizar tarefas repetitivas',
      icon: ICONS.TIME
    },
    {
      id: 'reports',
      title: 'Relatórios automáticos',
      description: 'Manter clientes informados',
      icon: ICONS.REPORT
    },
    {
      id: 'organization',
      title: 'Organizar processos',
      description: 'Melhor controle e visibilidade',
      icon: ICONS.CHART
    },
    {
      id: 'clients',
      title: 'Impressionar clientes',
      description: 'Demonstrar profissionalismo',
      icon: ICONS.CLIENT
    },
    {
      id: 'growth',
      title: 'Crescer o escritório',
      description: 'Escalar operações',
      icon: ICONS.ROCKET
    },
    {
      id: 'analysis',
      title: 'Análise estratégica',
      description: 'Insights para tomada de decisão',
      icon: ICONS.BRAIN
    }
  ];

  const toggleGoal = (goalId: string) => {
    const newGoals = profile.goals.includes(goalId)
      ? profile.goals.filter(g => g !== goalId)
      : [...profile.goals, goalId];
    setProfile({ ...profile, goals: newGoals });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-neutral-600 mb-4">
          Selecione seus principais objetivos com o JustoAI:
        </p>
        <div className="grid grid-cols-1 gap-3">
          {goals.map((goal) => (
            <Card
              key={goal.id}
              className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                profile.goals.includes(goal.id)
                  ? 'border-accent-500 bg-accent-50'
                  : 'border-neutral-200'
              }`}
              onClick={() => toggleGoal(goal.id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{goal.icon}</span>
                <div className="flex-1">
                  <h3 className="font-medium text-primary-800">{goal.title}</h3>
                  <p className="text-sm text-neutral-600">{goal.description}</p>
                </div>
                {profile.goals.includes(goal.id) && (
                  <span className="text-accent-500">{ICONS.CHECK}</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActionStep({ profile: _profile, onComplete }: { profile: UserProfile; onComplete: () => void }) {
  const [selectedAction, setSelectedAction] = useState<string>('');

  const actions = [
    {
      id: 'upload',
      title: 'Fazer primeiro upload',
      description: 'Subir uma cópia integral do processo em PDF',
      icon: ICONS.UPLOAD,
      action: () => window.location.href = '/dashboard/documents-upload'
    },
    {
      id: 'import',
      title: 'Importar dados existentes',
      description: 'Baixar nosso modelo Excel e importar seus dados',
      icon: ICONS.DOWNLOAD,
      action: () => {
        // Download CSV template
        const link = document.createElement('a');
        link.href = '/templates/modelo-importacao-justoai.csv';
        link.download = 'modelo-importacao-justoai.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.location.href = '/dashboard/clients', 1000);
      }
    },
    {
      id: 'explore',
      title: 'Explorar o dashboard',
      description: 'Conhecer as funcionalidades com dados de exemplo',
      icon: ICONS.CHART,
      action: () => onComplete()
    }
  ];

  const handleAction = () => {
    const action = actions.find(a => a.id === selectedAction);
    if (action) {
      action.action();
      onComplete();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-neutral-600 mb-4">
          Ótimo! Agora escolha como você gostaria de começar:
        </p>
        <div className="space-y-3">
          {actions.map((action) => (
            <Card
              key={action.id}
              className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                selectedAction === action.id
                  ? 'border-accent-500 bg-accent-50'
                  : 'border-neutral-200'
              }`}
              onClick={() => setSelectedAction(action.id)}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{action.icon}</span>
                <div className="flex-1">
                  <h3 className="font-medium text-primary-800">{action.title}</h3>
                  <p className="text-sm text-neutral-600">{action.description}</p>
                </div>
                {selectedAction === action.id && (
                  <span className="text-accent-500">{ICONS.CHECK}</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="bg-accent-50 border border-accent-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-accent-600">{ICONS.INFO}</span>
          <span className="font-medium text-accent-800">Dica</span>
        </div>
        <p className="text-sm text-accent-700">
          Você pode sempre voltar e explorar outras opções depois.
          O JustoAI foi feito para ser flexível e se adaptar ao seu fluxo de trabalho.
        </p>
      </div>

      {selectedAction && (
        <Button
          onClick={handleAction}
          className="w-full bg-gradient-to-r from-accent-500 to-primary-800"
        >
          {actions.find(a => a.id === selectedAction)?.title} {ICONS.ARROW_RIGHT}
        </Button>
      )}
    </div>
  );
}
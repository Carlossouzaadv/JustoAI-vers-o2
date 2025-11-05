/* eslint-disable react/no-unescaped-entities */
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DashboardOnboarding } from './onboarding-tour';
import { ICONS } from '../../../lib/icons';

// Este é um exemplo de como integrar o onboarding no dashboard
// Você deve adicionar os atributos data-onboarding nos elementos correspondentes do seu dashboard real

export function DashboardExample() {
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Componente de Onboarding */}
      <DashboardOnboarding />

      {/* Header do Dashboard */}
      <header
        className="bg-white shadow-sm border-b border-neutral-200 p-4"
        data-onboarding="dashboard-header"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary-800">Dashboard JustoAI</h1>
            <p className="text-neutral-600">Gerencie seus processos com inteligência artificial</p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              className="bg-accent-500 hover:bg-accent-600 text-white"
              data-onboarding="add-client-button"
            >
              {ICONS.UPLOAD}
              Adicionar Cliente
            </Button>
            <Button
              variant="outline"
              data-onboarding="settings-menu"
            >
              {ICONS.SETTINGS}
              Configurações
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8" data-onboarding="main-content">
        {/* Estatísticas do Dashboard */}
        <div
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
          data-onboarding="dashboard-stats"
        >
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Total de Processos</p>
                <p className="text-3xl font-bold text-primary-800">127</p>
              </div>
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                {ICONS.DOCUMENT}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Clientes Ativos</p>
                <p className="text-3xl font-bold text-accent-600">23</p>
              </div>
              <div className="w-12 h-12 bg-accent-100 rounded-lg flex items-center justify-center">
                {ICONS.HEART}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Prazos Críticos</p>
                <p className="text-3xl font-bold text-orange-600">5</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                {ICONS.CLOCK}
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-neutral-600">Relatórios Enviados</p>
                <p className="text-3xl font-bold text-green-600">89</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                {ICONS.MAIL}
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Lista de Processos */}
          <Card className="p-6" data-onboarding="process-list">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-primary-800">Processos Recentes</h2>
              <Button
                variant="outline"
                size="sm"
                data-onboarding="ai-analysis-button"
              >
                {ICONS.BRAIN}
                Analisar com IA
              </Button>
            </div>

            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      {ICONS.DOCUMENT}
                    </div>
                    <div>
                      <p className="font-medium text-primary-800">Processo {12345 + i}</p>
                      <p className="text-sm text-neutral-600">Cliente Silva & Associados</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Em andamento
                    </Badge>
                    <p className="text-xs text-neutral-500 mt-1">Atualizado há 2h</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Seção de Relatórios */}
          <Card className="p-6" data-onboarding="reports-section">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-primary-800">Relatórios Automáticos</h2>
              <Button variant="outline" size="sm">
                {ICONS.SETTINGS}
                Configurar
              </Button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-accent-50 rounded-lg border border-accent-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-accent-800">Relatório Semanal</p>
                  <Badge className="bg-accent-500 text-white">Ativo</Badge>
                </div>
                <p className="text-sm text-accent-700">Próximo envio: Segunda-feira, 07:00</p>
              </div>

              <div className="p-4 bg-neutral-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-neutral-800">Relatório Mensal</p>
                  <Badge variant="outline">Pausado</Badge>
                </div>
                <p className="text-sm text-neutral-600">Configurar agendamento</p>
              </div>
            </div>

            <Button className="w-full mt-4 bg-accent-500 hover:bg-accent-600 text-white">
              {ICONS.MAIL}
              Enviar Relatório Agora
            </Button>
          </Card>
        </div>

        {/* Instrução para desenvolvedores */}
        <Card className="p-6 mt-8 border-2 border-dashed border-accent-300 bg-accent-50">
          <h3 className="font-bold text-accent-800 mb-3">
            🚀 Como usar o Onboarding no seu Dashboard:
          </h3>
          <div className="space-y-2 text-sm text-accent-700">
            <p>1. Importe o componente <code className="bg-accent-100 px-1 rounded">DashboardOnboarding</code></p>
            <p>2. Adicione os atributos <code className="bg-accent-100 px-1 rounded">data-onboarding="[id]"</code> nos elementos</p>
            <p>3. Customize os steps no arquivo <code className="bg-accent-100 px-1 rounded">onboarding-tour.tsx</code></p>
            <p>4. Em desenvolvimento, use o botão "Reiniciar Tour" para testar</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { ICONS } from '@/lib/icons';

export default function ContatoSuportePage() {
  const [formData, setFormData] = useState({
    problemType: '',
    subject: '',
    description: '',
    email: '',
    name: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          formType: 'support',
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(result.message || 'Seu ticket foi enviado com sucesso!');
        setFormData({
          problemType: '',
          subject: '',
          description: '',
          email: '',
          name: ''
        });
      } else {
        const errorMsg = result.details
          ? Object.values(result.details).flat().join(', ')
          : result.error || 'Erro ao enviar ticket';
        alert(`Erro: ${errorMsg}`);
      }
    } catch (_error) {
      console.error('Erro ao enviar formulário:', error);
      alert('Erro ao enviar ticket. Tente novamente.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="font-display font-bold text-4xl sm:text-5xl text-primary-800 mb-4">
              Contato com o Suporte
            </h1>
            <p className="text-xl text-neutral-700 max-w-3xl mx-auto">
              Envie sua dúvida, problema ou sugestão. Nossa equipe responderá o mais rápido possível.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Left Side - Support Form */}
            <Card className="p-8">
              <h2 className="font-display font-bold text-2xl text-primary-800 mb-6">
                Formulário de Ticket
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Nome Completo *
                  </label>
                  <Input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Seu nome completo"
                    required
                    className="w-full"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Email *
                  </label>
                  <Input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="seu@email.com"
                    required
                    className="w-full"
                  />
                </div>

                {/* Problem Type */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Tipo de Problema *
                  </label>
                  <select
                    name="problemType"
                    value={formData.problemType}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">Selecione o tipo de problema</option>
                    <option value="tecnico">Problema Técnico</option>
                    <option value="billing">Questão de Faturamento</option>
                    <option value="feature">Dúvida sobre Funcionalidade</option>
                    <option value="integration">Problema de Integração</option>
                    <option value="other">Outro</option>
                  </select>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Assunto *
                  </label>
                  <Input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    placeholder="Resumo do seu problema ou dúvida"
                    required
                    className="w-full"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Descrição Detalhada *
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Descreva seu problema ou dúvida de forma detalhada. Inclua qualquer informação que possa nos ajudar a resolver seu caso mais rapidamente."
                    required
                    rows={6}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-vertical"
                  />
                </div>

                {/* Submit Button */}
                <Button type="submit" className="w-full bg-accent-500 hover:bg-accent-600 text-white">
                  Enviar Ticket
                  <span className="ml-2">{ICONS.MAIL}</span>
                </Button>
              </form>
            </Card>

            {/* Right Side - Contact Info and SLA */}
            <div className="space-y-8">
              {/* Contact Information */}
              <Card className="p-8">
                <h2 className="font-display font-bold text-2xl text-primary-800 mb-6">
                  Informações e Prazos
                </h2>

                <div className="space-y-4">
                  <div className="flex items-center">
                    <span className="text-accent-500 mr-3">{ICONS.MAIL}</span>
                    <div>
                      <p className="font-medium text-neutral-700">E-mail de Suporte</p>
                      <a href="mailto:suporte@justoai.com.br" className="text-accent-600 hover:underline">
                        suporte@justoai.com.br
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <span className="text-accent-500 mr-3">{ICONS.CLOCK}</span>
                    <div>
                      <p className="font-medium text-neutral-700">Horário de Atendimento</p>
                      <p className="text-neutral-600">Seg-Sex, 9h às 18h</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* SLA Information */}
              <Card className="p-8 bg-gradient-to-br from-accent-50 to-primary-50">
                <h3 className="font-display font-bold text-xl text-primary-800 mb-4">
                  {ICONS.CHECK} Nosso Compromisso
                </h3>
                <p className="text-neutral-700 leading-relaxed">
                  Garantimos uma primeira resposta em até <strong>24 horas úteis</strong>.
                  Tickets de clientes dos planos Professional e Enterprise são tratados com prioridade máxima.
                </p>
              </Card>

              {/* Additional Help */}
              <Card className="p-8">
                <h3 className="font-display font-bold text-xl text-primary-800 mb-4">
                  Outras Formas de Ajuda
                </h3>
                <div className="space-y-3">
                  <a
                    href="/help"
                    className="flex items-center text-accent-600 hover:text-accent-700 transition-colors"
                  >
                    <span className="mr-2">{ICONS.DOCUMENT}</span>
                    Central de Ajuda
                  </a>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
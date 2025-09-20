'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ICONS } from '../../../lib/icons';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    company: '',
    message: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement form submission
    console.log('Form submitted:', formData);
    alert('Sua mensagem foi enviada! Nossa equipe responderá em breve.');
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
          <div className="text-center mb-16">
            <h1 className="font-display font-bold text-4xl sm:text-5xl text-primary-800 mb-6">
              Entre em Contato
            </h1>
            <p className="text-xl text-neutral-700 max-w-2xl mx-auto">
              Estamos aqui para ajudar. Envie sua mensagem e nossa equipe responderá em breve.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-16">
            {/* Left Side - Contact Form */}
            <Card className="p-8">
              <h2 className="font-display font-bold text-2xl text-primary-800 mb-6">
                Envie uma Mensagem
              </h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Nome *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-accent-500"
                      placeholder="Seu nome completo"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-accent-500"
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Assunto *
                  </label>
                  <select
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-accent-500"
                  >
                    <option value="">Selecione o assunto</option>
                    <option value="duvida-comercial">Dúvida Comercial / Planos</option>
                    <option value="suporte-tecnico">Suporte Técnico / Dúvidas</option>
                    <option value="proposta-parceria">Proposta de Parceria</option>
                    <option value="contato-imprensa">Contato de Imprensa</option>
                    <option value="outros-assuntos">Outros Assuntos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Empresa
                  </label>
                  <input
                    type="text"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-accent-500"
                    placeholder="Nome da sua empresa"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Mensagem *
                  </label>
                  <textarea
                    name="message"
                    value={formData.message}
                    onChange={handleChange}
                    required
                    rows={5}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:border-accent-500"
                    placeholder="Como podemos ajudar você?"
                  />
                </div>

                <Button type="submit" className="w-full bg-accent-500 hover:bg-accent-600 text-lg py-3">
                  Enviar Mensagem
                  <span className="ml-2">{ICONS.MAIL}</span>
                </Button>
              </form>
            </Card>

            {/* Right Side - Contact Info */}
            <div className="space-y-8">
              {/* Contact Information */}
              <Card className="p-8">
                <h3 className="font-display font-bold text-xl text-primary-800 mb-6">
                  Informações de Contato
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <span className="text-accent-500 mr-3">{ICONS.MAIL}</span>
                    <div>
                      <p className="font-medium text-neutral-700">E-mail Geral</p>
                      <a href="mailto:contato@justoai.com.br" className="text-accent-600 hover:underline">
                        contato@justoai.com.br
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <span className="text-accent-500 mr-3">{ICONS.LOCATION}</span>
                    <div>
                      <p className="font-medium text-neutral-700">Endereço</p>
                      <p className="text-neutral-600">Rio de Janeiro, RJ, Brasil</p>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <span className="text-accent-500 mr-3">{ICONS.CLOCK}</span>
                    <div>
                      <p className="font-medium text-neutral-700">Horário de Atendimento</p>
                      <p className="text-neutral-600">Segunda a Sexta, 9h às 18h</p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Demo Card */}
              <Card className="p-8 text-center bg-gradient-to-br from-accent-50 to-accent-100">
                <div className="text-4xl mb-4">{ICONS.ROCKET}</div>
                <h3 className="font-display font-bold text-xl text-primary-800 mb-4">
                  Prefere uma Demo?
                </h3>
                <p className="text-neutral-700 mb-6">
                  Veja a JustoAI em ação com uma demonstração personalizada para seu escritório.
                </p>
                <Button className="bg-accent-500 hover:bg-accent-600 text-white">
                  Agendar Demo
                  <span className="ml-2">{ICONS.CALENDAR}</span>
                </Button>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
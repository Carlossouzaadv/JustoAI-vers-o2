'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ICONS } from '@/lib/icons';

export function FloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      text: 'Olá! Sou o assistente virtual da JustoAI. Como posso ajudar você a usar a plataforma hoje?',
      isBot: true,
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');

  const quickQuestions = [
    'Como criar minha conta?',
    'Como fazer upload de processos?',
    'Como configurar relatórios?',
    'Quais formatos são suportados?',
    'Como importar dados do Excel?'
  ];

  const handleSendMessage = (message: string) => {
    if (!message.trim()) return;

    // Adicionar mensagem do usuário
    const userMessage = {
      text: message,
      isBot: false,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // Simular resposta do bot (aqui você integraria com API real)
    setTimeout(() => {
      const botResponse = getBotResponse(message);
      setMessages(prev => [...prev, {
        text: botResponse,
        isBot: true,
        timestamp: new Date()
      }]);
    }, 1000);
  };

  const getBotResponse = (message: string): string => {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('conta') || lowerMessage.includes('cadastro')) {
      return "Para criar sua conta, clique em 'Teste 7 dias grátis' na página inicial. Você precisará apenas do seu email e não é necessário cartão de crédito.";
    }

    if (lowerMessage.includes('upload') || lowerMessage.includes('processo')) {
      return "Para fazer upload de processos, acesse seu dashboard e clique em 'Upload de Processos'. Suportamos arquivos PDF e imagens (JPG, PNG).";
    }

    if (lowerMessage.includes('relatório') || lowerMessage.includes('relatorio')) {
      return "Para configurar relatórios automáticos, vá em 'Relatórios' no dashboard e configure a frequência (semanal, quinzenal ou mensal) e o template desejado.";
    }

    if (lowerMessage.includes('formato') || lowerMessage.includes('arquivo')) {
      return 'Suportamos arquivos PDF, imagens (JPG, PNG) para upload de processos e planilhas Excel/CSV para importação de dados.';
    }

    if (lowerMessage.includes('excel') || lowerMessage.includes('csv') || lowerMessage.includes('importar')) {
      return "Para importar dados do Excel/CSV, prepare uma planilha com as colunas: número do processo, cliente, status e data. Use a seção 'Integrações' no dashboard.";
    }

    return 'Obrigado pela pergunta! Para respostas mais detalhadas, recomendo verificar nossa Central de Ajuda ou entrar em contato com nosso suporte em suporte@justoai.com.br';
  };

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={() => setIsOpen(true)}
            className="w-14 h-14 rounded-full bg-accent-500 hover:bg-accent-600 shadow-lg"
          >
            <span className="text-2xl">{ICONS.MAIL}</span>
          </Button>
        </div>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-80 h-96">
          <Card className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-primary-800 text-white rounded-t-lg">
              <div className="flex items-center">
                <span className="text-xl mr-2">{ICONS.ROBOT}</span>
                <span className="font-semibold">Assistente JustoAI</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-white hover:bg-primary-700"
              >
                ×
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                      message.isBot
                        ? 'bg-gray-100 text-gray-800'
                        : 'bg-accent-500 text-white'
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Questions */}
            {messages.length === 1 && (
              <div className="px-4 pb-2">
                <p className="text-xs text-gray-500 mb-2">Perguntas frequentes:</p>
                <div className="space-y-1">
                  {quickQuestions.slice(0, 3).map((question, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="w-full text-left text-xs h-auto py-1"
                      onClick={() => handleSendMessage(question)}
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputValue)}
                  placeholder="Digite sua pergunta..."
                  className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-accent-500"
                />
                <Button
                  size="sm"
                  onClick={() => handleSendMessage(inputValue)}
                  className="bg-accent-500 hover:bg-accent-600"
                >
                  <span className="text-sm">{ICONS.ARROW_RIGHT}</span>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
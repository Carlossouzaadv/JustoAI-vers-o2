'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ICONS } from '@/lib/icons';
import { useAuth } from '@/contexts/auth-context';

interface Message {
  id?: string;
  text: string;
  isBot: boolean;
  timestamp: Date;
  isStreaming?: boolean;
}

export function FloatingChat() {
  const { user, currentWorkspace } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const quickQuestions = [
    'Como criar minha conta?',
    'Como fazer upload de processos?',
    'Como configurar relatórios?',
    'Quais formatos são suportados?',
    'Como importar dados do Excel?'
  ];

  // Initialize chat session
  useEffect(() => {
    if (isOpen && !sessionId && user?.id) {
      createChatSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sessionId, user?.id]);

  const createChatSession = async () => {
    try {
      const workspaceId = currentWorkspace?.workspaceId || '';

      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId,
        },
        body: JSON.stringify({
          title: 'Floating Chat',
          contextType: 'general',
        }),
      });

      if (!response.ok) {
        console.error('Failed to create chat session');
        return;
      }

      const data = await response.json();
      setSessionId(data.data.id);
    } catch (error) {
      console.error('Error creating chat session:', error);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || !sessionId || isLoading) return;

    // Add user message
    const userMessage: Message = {
      text: message,
      isBot: false,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const workspaceId = currentWorkspace?.workspaceId || '';

      // Send message to API
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': workspaceId,
        },
        body: JSON.stringify({
          sessionId,
          content: message,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Stream response
      const botMessage: Message = {
        text: '',
        isBot: true,
        timestamp: new Date(),
        isStreaming: true,
      };

      setMessages(prev => [...prev, botMessage]);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        setMessages(prev => {
          const updated = [...prev];
          const lastMessage = updated[updated.length - 1];
          if (lastMessage && lastMessage.isBot) {
            lastMessage.text += chunk;
          }
          return updated;
        });
      }

      // Mark streaming as complete
      setMessages(prev => {
        const updated = [...prev];
        const lastMessage = updated[updated.length - 1];
        if (lastMessage && lastMessage.isBot) {
          lastMessage.isStreaming = false;
        }
        return updated;
      });
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        text: 'Desculpe, houve um erro ao processar sua mensagem. Por favor, tente novamente.',
        isBot: true,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
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
                    {message.isStreaming && <span className="animate-pulse">▋</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Questions */}
            {messages.length === 0 && !isLoading && sessionId && (
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
                  disabled={isLoading || !sessionId}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:border-accent-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Button
                  size="sm"
                  onClick={() => handleSendMessage(inputValue)}
                  disabled={isLoading || !sessionId}
                  className="bg-accent-500 hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-sm">{isLoading ? '⏳' : ICONS.ARROW_RIGHT}</span>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
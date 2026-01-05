'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Building2, MessageSquare, Briefcase, Phone, Mail, User } from 'lucide-react';

interface EnterpriseModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function EnterpriseModal({ isOpen, onClose }: EnterpriseModalProps) {
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [success, setSuccess] = React.useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        const formData = new FormData(e.currentTarget);
        const data = {
            name: formData.get('name') as string,
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
            firmSize: formData.get('firmSize') as string,
            needs: formData.get('needs') as string,
        };

        try {
            const response = await fetch('/api/contact/enterprise', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error((errorData as { error?: string }).error || 'Erro ao enviar solicitação');
            }

            setSuccess(true);
            // Close after a brief delay to show success
            setTimeout(() => {
                onClose();
                setSuccess(false);
            }, 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px] border-l-4 border-l-purple-600">
                <DialogHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0">
                            Enterprise
                        </Badge>
                    </div>
                    <DialogTitle className="text-2xl font-bold text-gray-900">
                        Vamos conversar sobre suas necessidades
                    </DialogTitle>
                    <DialogDescription className="text-base text-gray-600">
                        Preencha o formulário abaixo e um de nossos especialistas em eficiência jurídica entrará em contato para desenhar o plano ideal para seu escritório.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="flex items-center gap-2">
                                <User className="w-4 h-4 text-gray-500" />
                                Nome completo
                            </Label>
                            <Input id="name" name="name" placeholder="Seu nome" required />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-gray-500" />
                                Email corporativo
                            </Label>
                            <Input id="email" name="email" type="email" placeholder="voce@empresa.com" required />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="phone" className="flex items-center gap-2">
                                <Phone className="w-4 h-4 text-gray-500" />
                                Telefone / WhatsApp
                            </Label>
                            <Input id="phone" name="phone" type="tel" placeholder="(11) 99999-9999" required />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="firmSize" className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-gray-500" />
                                Tamanho do escritório
                            </Label>
                            <Input id="firmSize" name="firmSize" placeholder="Ex: 50+ advogados" required />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="needs" className="flex items-center gap-2">
                            <Briefcase className="w-4 h-4 text-gray-500" />
                            Quais suas principais necessidades?
                        </Label>
                        <Textarea
                            id="needs"
                            name="needs"
                            placeholder="Descreva brevemente o que você busca (ex: integração via API, volume alto de processos, IA personalizada...)"
                            className="min-h-[100px]"
                        />
                    </div>

                    {/* Feedback Messages */}
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                            ✅ Solicitação enviada! Entraremos em contato em breve.
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 shadow-lg"
                            disabled={isSubmitting || success}
                        >
                            {isSubmitting ? 'Enviando...' : 'Enviar Solicitação'}
                            {!isSubmitting && <MessageSquare className="w-4 h-4 ml-2" />}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

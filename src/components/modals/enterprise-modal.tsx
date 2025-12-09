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
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // TODO: Implement actual submission logic
        console.log('Enterprise form submitted');
        onClose();
        // Maybe show a success toast here
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

                    <div className="flex justify-end gap-3 pt-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white border-0 shadow-lg"
                        >
                            Enviar Solicitação <MessageSquare className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

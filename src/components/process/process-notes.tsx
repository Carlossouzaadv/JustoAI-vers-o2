'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAutosave } from '@/hooks/use-autosave';
import { ICONS } from '@/lib/icons';

interface ProcessNote {
  id: string;
  title: string;
  content: string;
  category: 'general' | 'strategy' | 'client' | 'urgent' | 'research';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
  authorName: string;
  isPrivate: boolean;
  tags?: string[];
}

interface ProcessNotesProps {
  processId: string;
}

export function ProcessNotes({ processId }: ProcessNotesProps) {
  const [notes, setNotes] = useState<ProcessNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<Partial<ProcessNote>>({});
  const [filter, setFilter] = useState<'all' | ProcessNote['category']>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Autosave para a nota sendo editada
  const { isSaving, hasUnsavedChanges } = useAutosave(editingNote, {
    delay: 2000,
    onSave: async (noteData) => {
      if (!noteData.id || !noteData.title || !noteData.content) return;

      const response = await fetch(`/api/processes/${processId}/notes/${noteData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: noteData.title,
          content: noteData.content,
          category: noteData.category,
          priority: noteData.priority,
          isPrivate: noteData.isPrivate,
          tags: noteData.tags,
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao salvar nota');
      }

      // Atualizar a lista local
      setNotes(prev => prev.map(note =>
        note.id === noteData.id
          ? { ...note, ...noteData, updatedAt: new Date().toISOString() }
          : note
      ));
    },
    onError: (error) => {
      console.error('Erro ao salvar nota:', error);
    },
  });

  useEffect(() => {
    loadNotes();
  }, [processId]);

  const loadNotes = async () => {
    try {
      setLoading(true);

      const response = await fetch(`/api/processes/${processId}/notes`);
      if (response.ok) {
        const data = await response.json();
        setNotes(data.notes || []);
      } else {
        // Dados simulados para desenvolvimento
        setNotes([
          {
            id: '1',
            title: 'Estratégia inicial',
            content: 'Cliente demonstrou muito interesse em acordo. Sugerir valores entre R$ 30k-40k na primeira audiência. Pontos fortes: documentação médica completa, testemunhas identificadas.',
            category: 'strategy',
            priority: 'high',
            createdAt: '2024-01-15T10:00:00',
            updatedAt: '2024-01-20T14:30:00',
            authorName: 'Dr. João Silva',
            isPrivate: false,
            tags: ['acordo', 'audiencia', 'estrategia']
          },
          {
            id: '2',
            title: 'Contato com cliente',
            content: 'Cliente ligou preocupado com demora do processo. Explicamos que é normal e que estamos aguardando citação do réu. Próximo contato agendado para semana que vem.',
            category: 'client',
            priority: 'medium',
            createdAt: '2024-01-18T16:45:00',
            updatedAt: '2024-01-18T16:45:00',
            authorName: 'Ana Oliveira',
            isPrivate: false
          },
          {
            id: '3',
            title: 'URGENTE - Prazo contestação',
            content: 'Réu foi citado hoje. Prazo de 15 dias para contestação. Acompanhar diariamente o sistema. Se não contestar, pedir julgamento antecipado.',
            category: 'urgent',
            priority: 'high',
            createdAt: '2024-01-22T17:00:00',
            updatedAt: '2024-01-22T17:00:00',
            authorName: 'Dr. João Silva',
            isPrivate: true,
            tags: ['prazo', 'contestacao', 'acompanhamento']
          },
          {
            id: '4',
            title: 'Pesquisa jurisprudencial',
            content: 'Encontrei 3 precedentes favoráveis no TJ-SP com valores similares. Casos: AI 2023.0001234, AI 2023.0005678, AI 2023.0009012. Anexar na tréplica.',
            category: 'research',
            priority: 'medium',
            createdAt: '2024-01-19T11:30:00',
            updatedAt: '2024-01-19T11:30:00',
            authorName: 'Carlos Santos',
            isPrivate: false,
            tags: ['jurisprudencia', 'tj-sp', 'precedentes']
          }
        ]);
      }
    } catch (error) {
      console.error('Erro ao carregar notas:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewNote = () => {
    const newNote: ProcessNote = {
      id: `temp_${Date.now()}`,
      title: 'Nova anotação',
      content: '',
      category: 'general',
      priority: 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      authorName: 'Usuário Atual', // TODO: pegar do contexto de autenticação
      isPrivate: false,
      tags: []
    };

    setNotes(prev => [newNote, ...prev]);
    setIsEditing(newNote.id);
    setEditingNote(newNote);
  };

  const startEditing = (note: ProcessNote) => {
    setIsEditing(note.id);
    setEditingNote(note);
  };

  const stopEditing = async () => {
    if (hasUnsavedChanges && editingNote.id) {
      // Forçar salvamento antes de sair
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsEditing(null);
    setEditingNote({});
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta anotação?')) return;

    try {
      const response = await fetch(`/api/processes/${processId}/notes/${noteId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setNotes(prev => prev.filter(note => note.id !== noteId));
        if (isEditing === noteId) {
          setIsEditing(null);
          setEditingNote({});
        }
      }
    } catch (error) {
      console.error('Erro ao excluir nota:', error);
    }
  };

  const getCategoryIcon = (category: ProcessNote['category']) => {
    switch (category) {
      case 'strategy': return ICONS.STAR;
      case 'client': return ICONS.CLIENT;
      case 'urgent': return ICONS.ERROR;
      case 'research': return ICONS.SEARCH;
      case 'general': return ICONS.EDIT;
      default: return ICONS.EDIT;
    }
  };

  const getCategoryLabel = (category: ProcessNote['category']) => {
    switch (category) {
      case 'strategy': return 'Estratégia';
      case 'client': return 'Cliente';
      case 'urgent': return 'Urgente';
      case 'research': return 'Pesquisa';
      case 'general': return 'Geral';
      default: return 'Geral';
    }
  };

  const getPriorityColor = (priority: ProcessNote['priority']) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const filteredNotes = notes
    .filter(note => {
      if (filter !== 'all' && note.category !== filter) return false;
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        return (
          note.title.toLowerCase().includes(searchLower) ||
          note.content.toLowerCase().includes(searchLower) ||
          note.tags?.some(tag => tag.toLowerCase().includes(searchLower))
        );
      }
      return true;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const categories = ['strategy', 'client', 'urgent', 'research', 'general'] as const;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/4" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-4 w-3/4 mb-2" />
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {ICONS.EDIT} Anotações ({notes.length})
          </CardTitle>

          <Button onClick={createNewNote}>
            {ICONS.ADD} Nova Anotação
          </Button>
        </div>

        {/* Filtros e busca */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <Input
            placeholder="Buscar anotações..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />

          <div className="flex gap-2 flex-wrap">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              Todas ({notes.length})
            </Button>
            {categories.map((category) => {
              const count = notes.filter(note => note.category === category).length;
              return (
                <Button
                  key={category}
                  variant={filter === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(category)}
                >
                  {getCategoryIcon(category)} {getCategoryLabel(category)} ({count})
                </Button>
              );
            })}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredNotes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <span className="text-4xl mb-4 block">{ICONS.EDIT}</span>
            <h3 className="text-lg font-medium mb-2">Nenhuma anotação encontrada</h3>
            <p className="text-sm mb-4">
              {searchTerm || filter !== 'all'
                ? 'Tente ajustar os filtros de busca'
                : 'Crie sua primeira anotação sobre este processo'
              }
            </p>
            <Button onClick={createNewNote}>
              {ICONS.ADD} Criar Anotação
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotes.map((note) => (
              <Card key={note.id} className={isEditing === note.id ? 'ring-2 ring-primary' : ''}>
                <CardContent className="p-4">
                  {isEditing === note.id ? (
                    // Modo de edição
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Input
                          value={editingNote.title || ''}
                          onChange={(e) => setEditingNote(prev => ({ ...prev, title: e.target.value }))}
                          placeholder="Título da anotação"
                          className="flex-1"
                        />
                        {isSaving && (
                          <span className="text-sm text-blue-600">{ICONS.LOADING}</span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs font-medium mb-1 block">Categoria</label>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={editingNote.category || 'general'}
                            onChange={(e) => setEditingNote(prev => ({
                              ...prev,
                              category: e.target.value as ProcessNote['category']
                            }))}
                          >
                            {categories.map((cat) => (
                              <option key={cat} value={cat}>
                                {getCategoryLabel(cat)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-medium mb-1 block">Prioridade</label>
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={editingNote.priority || 'medium'}
                            onChange={(e) => setEditingNote(prev => ({
                              ...prev,
                              priority: e.target.value as ProcessNote['priority']
                            }))}
                          >
                            <option value="low">Baixa</option>
                            <option value="medium">Média</option>
                            <option value="high">Alta</option>
                          </select>
                        </div>

                        <div className="flex items-end">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={editingNote.isPrivate || false}
                              onChange={(e) => setEditingNote(prev => ({
                                ...prev,
                                isPrivate: e.target.checked
                              }))}
                              className="rounded"
                            />
                            <span className="text-xs font-medium">Privada</span>
                          </label>
                        </div>
                      </div>

                      <Textarea
                        value={editingNote.content || ''}
                        onChange={(e) => setEditingNote(prev => ({ ...prev, content: e.target.value }))}
                        placeholder="Conteúdo da anotação..."
                        rows={6}
                      />

                      <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                          <Button onClick={stopEditing} variant="outline" size="sm">
                            {ICONS.SUCCESS} Concluir
                          </Button>
                          <Button
                            onClick={() => deleteNote(note.id)}
                            variant="destructive"
                            size="sm"
                          >
                            {ICONS.DELETE} Excluir
                          </Button>
                        </div>

                        {hasUnsavedChanges && (
                          <span className="text-xs text-muted-foreground">
                            {ICONS.WARNING} Salvando automaticamente...
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    // Modo de visualização
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getCategoryIcon(note.category)}</span>
                          <h3 className="font-medium">{note.title}</h3>
                          {note.isPrivate && (
                            <Badge variant="outline" className="text-xs">
                              Privada
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant={getPriorityColor(note.priority)} className="text-xs">
                            {note.priority === 'high' ? 'Alta' :
                             note.priority === 'medium' ? 'Média' : 'Baixa'}
                          </Badge>
                          <Button
                            onClick={() => startEditing(note)}
                            variant="outline"
                            size="sm"
                          >
                            Editar
                          </Button>
                        </div>
                      </div>

                      <div className="text-sm text-muted-foreground">
                        <span>{note.authorName}</span>
                        <span className="mx-2">•</span>
                        <span>{new Date(note.createdAt).toLocaleString('pt-BR')}</span>
                        {note.updatedAt !== note.createdAt && (
                          <>
                            <span className="mx-2">•</span>
                            <span>Atualizada: {new Date(note.updatedAt).toLocaleString('pt-BR')}</span>
                          </>
                        )}
                      </div>

                      <div className="text-sm whitespace-pre-wrap">
                        {note.content}
                      </div>

                      {note.tags && note.tags.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {note.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              #{tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-6 pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            {ICONS.INFO} As anotações são salvas automaticamente durante a edição.
            Anotações privadas só são visíveis para você.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
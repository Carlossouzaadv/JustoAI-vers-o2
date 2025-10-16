// Exemplo de uso correto dos ícones seguros para Windows
import React from 'react';
import { ICONS, EMOJIS, UI_TEXT, useIcon } from '@/lib/icons';

export function ExampleUsage() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Exemplos de Uso - Ícones Seguros</h2>

      {/* Usando constantes pré-definidas */}
      <div className="space-y-2">
        <h3 className="font-semibold">Status Messages:</h3>
        <p className="text-green-600">{UI_TEXT.SUCCESS}</p>
        <p className="text-red-600">{UI_TEXT.ERROR}</p>
        <p className="text-yellow-600">{UI_TEXT.WARNING}</p>
        <p className="text-blue-600">{UI_TEXT.LOADING}</p>
      </div>

      {/* Usando ícones individuais */}
      <div className="space-y-2">
        <h3 className="font-semibold">Botões com Ícones:</h3>
        <div className="space-x-2">
          <button className="px-3 py-2 bg-blue-500 text-white rounded">
            {ICONS.SAVE} Salvar
          </button>
          <button className="px-3 py-2 bg-gray-500 text-white rounded">
            {ICONS.EDIT} Editar
          </button>
          <button className="px-3 py-2 bg-red-500 text-white rounded">
            {ICONS.DELETE} Excluir
          </button>
        </div>
      </div>

      {/* Navegação */}
      <div className="space-y-2">
        <h3 className="font-semibold">Navegação:</h3>
        <div className="space-x-2">
          <button className="px-3 py-2 border rounded">
            {ICONS.ARROW_LEFT} Voltar
          </button>
          <button className="px-3 py-2 border rounded">
            Próximo {ICONS.ARROW_RIGHT}
          </button>
        </div>
      </div>

      {/* Estados */}
      <div className="space-y-2">
        <h3 className="font-semibold">Estados:</h3>
        <ul className="space-y-1">
          <li>{ICONS.CIRCLE_FILLED} Tarefa completa</li>
          <li>{ICONS.CIRCLE_EMPTY} Tarefa pendente</li>
          <li>{ICONS.STAR} Item favorito</li>
          <li>{ICONS.STAR_EMPTY} Item normal</li>
        </ul>
      </div>

      {/* Exemplo com hook personalizado */}
      <div className="space-y-2">
        <h3 className="font-semibold">Com Hook Personalizado:</h3>
        <p>Status: {useIcon('SUCCESS', 'OK')}</p>
        <p>Loading: {useIcon('LOADING', '...')}</p>
      </div>

      {/* Emojis seguros */}
      <div className="space-y-2">
        <h3 className="font-semibold">Emojis (com fallback):</h3>
        <p>Muito bom! {EMOJIS.THUMBS_UP}</p>
        <p>Feliz {EMOJIS.SMILE}</p>
        <p>Em alta {EMOJIS.FIRE}</p>
        <p>Rápido {EMOJIS.ROCKET}</p>
      </div>

      {/* EVITE ESTES EXEMPLOS - apenas para demonstração */}
      <div className="space-y-2 border-t pt-4 opacity-50">
        <h3 className="font-semibold text-red-600">❌ Evite (pode quebrar no Windows):</h3>
        <p className="text-sm text-gray-600">
          {/* ❌ Emojis diretos: */}<br/>
          {/* const message = "✅ Sucesso!"; */}<br/>
          {/* const button = "🔥 Hot"; */}<br/>
          {/* const status = "⚠️ Atenção"; */}<br/><br/>

          {/* ✅ Use em vez disso: */}<br/>
          {/* const message = `{ICONS.SUCCESS} Sucesso!`; */}<br/>
          {/* const button = `{EMOJIS.FIRE} Hot`; */}<br/>
          {/* const status = `{ICONS.WARNING} Atenção`; */}
        </p>
      </div>
    </div>
  );
}
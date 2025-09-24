// ================================================================
// PÁGINA OFFLINE - JUSTOAI V2
// ================================================================
// Página exibida quando o usuário está offline

'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
        <div className="mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 110 19.5 9.75 9.75 0 010-19.5z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Você está offline
          </h1>
          <p className="text-gray-600">
            Verifique sua conexão com a internet e tente novamente.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Tentar novamente
          </button>

          <button
            onClick={() => window.history.back()}
            className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors"
          >
            Voltar
          </button>
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-medium text-blue-900 mb-2">
            📱 Algumas funcionalidades podem estar disponíveis offline
          </h3>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Páginas já visitadas</li>
            <li>• Imagens em cache</li>
            <li>• Dados já carregados</li>
          </ul>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          JustoAI - Assistente Jurídico Inteligente
        </div>
      </div>
    </div>
  );
}
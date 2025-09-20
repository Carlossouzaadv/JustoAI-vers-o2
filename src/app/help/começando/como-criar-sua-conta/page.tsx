import { HelpArticleLayout } from '@/components/help/help-article-layout';

export default function ComocriarSuaContaPage() {
  return (
    <HelpArticleLayout
      title="Como criar sua conta"
      category="Começando"
      readTime="3 min"
    >
      <p className="text-lg text-neutral-700 mb-6">
        Criar sua conta na JustoAI é rápido e simples. Siga este guia passo a passo para começar a usar nossa plataforma de automação jurídica.
      </p>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Passo 1: Acesse a página de cadastro
      </h2>
      <p className="text-neutral-700 mb-4">
        Visite nossa página inicial e clique no botão <strong>"Teste 7 dias grátis"</strong> no canto superior direito ou na seção principal da página.
      </p>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Passo 2: Preencha seus dados
      </h2>
      <p className="text-neutral-700 mb-4">
        Você precisará fornecer as seguintes informações:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li><strong>Nome completo:</strong> Seu nome como aparece em documentos oficiais</li>
        <li><strong>Email profissional:</strong> Recomendamos usar o email do seu escritório</li>
        <li><strong>Telefone:</strong> Para contato e suporte técnico</li>
        <li><strong>OAB:</strong> Número da sua inscrição na Ordem dos Advogados</li>
        <li><strong>Nome do escritório:</strong> Se aplicável</li>
        <li><strong>Senha:</strong> Mínimo de 8 caracteres com pelo menos uma letra maiúscula e um número</li>
      </ul>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Passo 3: Confirme seu email
      </h2>
      <p className="text-neutral-700 mb-4">
        Após o cadastro, você receberá um email de confirmação. Clique no link para ativar sua conta. Se não receber o email em alguns minutos, verifique sua caixa de spam.
      </p>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Passo 4: Acesse seu dashboard
      </h2>
      <p className="text-neutral-700 mb-4">
        Com sua conta ativada, você será direcionado automaticamente para o dashboard da JustoAI, onde poderá:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li>Fazer seu primeiro upload de processos</li>
        <li>Configurar relatórios automáticos</li>
        <li>Explorar todas as funcionalidades disponíveis</li>
      </ul>

      <div className="bg-accent-50 border border-accent-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-lg text-primary-800 mb-2">
          💡 Dica importante
        </h3>
        <p className="text-neutral-700">
          Durante os 7 dias gratuitos, você tem acesso completo a todas as funcionalidades, incluindo 3 análises gratuitas de processos. Não é necessário cartão de crédito para começar.
        </p>
      </div>

      <h2 className="font-semibold text-2xl text-primary-800 mb-4">
        Problemas no cadastro?
      </h2>
      <p className="text-neutral-700 mb-4">
        Se encontrar alguma dificuldade durante o processo de cadastro, verifique:
      </p>
      <ul className="list-disc list-inside text-neutral-700 mb-6 space-y-2">
        <li>Se todos os campos obrigatórios estão preenchidos</li>
        <li>Se o email inserido é válido e está digitado corretamente</li>
        <li>Se a senha atende aos critérios mínimos de segurança</li>
        <li>Se você já possui uma conta com o email informado</li>
      </ul>

      <p className="text-neutral-700">
        Caso continue com problemas, nossa equipe de suporte está pronta para ajudar em <strong>suporte@justoai.com.br</strong>.
      </p>
    </HelpArticleLayout>
  );
}
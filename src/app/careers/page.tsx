import { Button } from '@/components/ui/button';
import { ICONS } from '@/lib/icons';

export default function CareersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-16">
            <h1 className="font-display font-bold text-4xl sm:text-5xl text-primary-800 mb-6">
              Junte-se à missão de transformar a advocacia no Brasil
            </h1>
            <p className="text-xl text-neutral-700 max-w-3xl mx-auto leading-relaxed">
              Não estamos apenas construindo um software. Estamos criando o futuro da prática jurídica: mais inteligente, mais rápido e mais justo. Buscamos pessoas excepcionais que acreditam que a tecnologia pode empoderar advogados a fazerem seu melhor trabalho.
            </p>
          </div>

          {/* How We Work Section */}
          <div className="mb-16">
            <div className="bg-white rounded-2xl shadow-xl p-8 lg:p-12">
              <h2 className="font-display font-bold text-3xl text-primary-800 mb-8 text-center">
                Nossos Valores na Prática
              </h2>
              <div className="space-y-8">
                <div>
                  <h3 className="font-semibold text-xl text-primary-800 mb-3 flex items-center">
                    <span className="text-accent-500 mr-3">{ICONS.HEART}</span>
                    Obsessão pelo Problema do Cliente
                  </h3>
                  <p className="text-lg text-neutral-700 leading-relaxed">
                    Antes de qualquer linha de código, existe um advogado real com um desafio real. Nossa bússola é resolver dores concretas da advocacia, com empatia e profundidade.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-xl text-primary-800 mb-3 flex items-center">
                    <span className="text-accent-500 mr-3">{ICONS.SPARKLES}</span>
                    Simplicidade é a Máxima Sofisticação
                  </h3>
                  <p className="text-lg text-neutral-700 leading-relaxed">
                    O mundo jurídico já é complexo o suficiente. Nossa missão é criar tecnologia tão intuitiva que se torna invisível, permitindo que o foco esteja sempre na estratégia.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-xl text-primary-800 mb-3 flex items-center">
                    <span className="text-accent-500 mr-3">{ICONS.SHIELD}</span>
                    Autonomia com Responsabilidade
                  </h3>
                  <p className="text-lg text-neutral-700 leading-relaxed">
                    Acreditamos em dar liberdade para criar e inovar. Com essa liberdade, vem a responsabilidade de entregar resultados que impactam diretamente o sucesso dos nossos clientes.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Are You The Right Person Section */}
          <div className="text-center bg-white rounded-2xl shadow-xl p-8 lg:p-12">
            <h2 className="font-display font-bold text-3xl text-primary-800 mb-6">
              Você é a pessoa certa para a JustoAI?
            </h2>
            <p className="text-lg text-neutral-700 leading-relaxed mb-8 max-w-3xl mx-auto">
              No momento, não temos vagas abertas, mas estamos sempre construindo o futuro. Se você é um(a) desenvolvedor(a), designer, ou profissional de marketing apaixonado(a) por resolver problemas complexos e acredita na nossa missão, queremos conhecer você. Se você se identifica com nossa missão, envie seu currículo e nos diga como você ajudaria a construir o futuro da JustoAI. As pessoas certas criam suas próprias oportunidades.
            </p>
            <Button size="lg" className="bg-accent-500 hover:bg-accent-600 text-white">
              QUERO FAZER PARTE DA HISTÓRIA
              <span className="ml-2">{ICONS.ROCKET}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
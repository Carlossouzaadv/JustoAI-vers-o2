import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ICONS } from '../../../lib/icons';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header Section */}
          <div className="text-center mb-16">
            <h1 className="font-display font-bold text-4xl sm:text-5xl text-primary-800 mb-6">
              Feito por um advogado, para advogados.
            </h1>
          </div>

          {/* Main Story Section */}
          <div className="mb-16">
            <div className="bg-white rounded-2xl shadow-xl p-8 lg:p-12">
              <p className="text-lg text-neutral-700 leading-relaxed mb-6">
                Horas incontáveis gastas em tarefas repetitivas. A pressão para manter clientes informados com relatórios claros e, ao mesmo tempo, gerenciar prazos e a complexidade dos casos. A sensação de que o dia precisava ter 30 horas para dar conta de tudo.
              </p>
              <p className="text-lg text-neutral-700 leading-relaxed mb-6">
                Essa era a minha realidade na advocacia. Eu sabia que a tecnologia poderia ser a resposta, mas as ferramentas disponíveis pareciam complexas, caras ou simplesmente não entendiam as nuances do dia a dia de um escritório brasileiro.
              </p>
              <p className="text-lg text-neutral-700 leading-relaxed mb-6">
                A JustoAI nasceu dessa frustração e de uma convicção: a de que a automação inteligente não deveria ser um luxo para grandes bancas, mas uma ferramenta acessível para todos os advogados que buscam eficiência e excelência.
              </p>
              <p className="text-lg text-neutral-700 leading-relaxed">
                Eu não criei apenas um software. Criei a solução que eu mesmo precisava para focar no que realmente importa: a estratégia jurídica e a defesa dos direitos dos meus clientes. A JustoAI é a união de anos de prática jurídica com o poder da tecnologia. É a ferramenta para transformar a sua advocacia.
              </p>
            </div>
          </div>

          {/* Founder Section */}
          <div className="mb-16">
            <h2 className="font-display font-bold text-3xl text-primary-800 mb-8 text-center">
              Do Fórum ao Código: O Fundador
            </h2>
            <div className="bg-white rounded-2xl shadow-xl p-8 lg:p-12">
              <div className="grid lg:grid-cols-2 gap-8 items-center">
                <div className="text-center lg:text-left">
                  <Image
                    src="/founder-photo.jpg"
                    alt="Carlos - Fundador da JustoAI"
                    width={300}
                    height={300}
                    className="rounded-xl mx-auto lg:mx-0 object-cover w-64 h-64"
                  />
                </div>
                <div>
                  <p className="text-lg text-neutral-700 leading-relaxed">
                    Carlos é advogado, apaixonado por tecnologia e o fundador da JustoAI. Com mais de 15 anos de experiência atuando com foco em direito tributário e societário, ele vivenciou na prática os desafios que a maioria dos escritórios no Brasil enfrenta. Cansado de processos manuais e da falta de ferramentas que realmente entendessem a rotina jurídica, decidiu unir seu conhecimento legal e paixão por tecnologia para criar a solução que ele mesmo precisava. A JustoAI é a materialização de sua visão: uma advocacia mais inteligente, eficiente e focada no cliente.
                  </p>
                  <div className="mt-6">
                    <a
                      href="https://www.linkedin.com/in/carlos-souza-5874315b/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-accent-600 hover:text-accent-700 font-medium transition-colors"
                    >
                      {ICONS.LINKEDIN} Conecte-se no LinkedIn
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Target Audience Section */}
          <div className="mb-16">
            <h2 className="font-display font-bold text-3xl text-primary-800 mb-8 text-center">
              Para quem é a JustoAI?
            </h2>
            <div className="bg-white rounded-2xl shadow-xl p-8 lg:p-12">
              <div className="space-y-6">
                <div className="flex items-start">
                  <span className="text-accent-500 mr-4 mt-1">{ICONS.SUCCESS}</span>
                  <p className="text-lg text-neutral-700">
                    Para o advogado autônomo que precisa de um braço direito tecnológico para gerenciar tudo.
                  </p>
                </div>
                <div className="flex items-start">
                  <span className="text-accent-500 mr-4 mt-1">{ICONS.SUCCESS}</span>
                  <p className="text-lg text-neutral-700">
                    Para o pequeno e médio escritório que busca otimizar a produtividade da equipe sem custos exorbitantes.
                  </p>
                </div>
                <div className="flex items-start">
                  <span className="text-accent-500 mr-4 mt-1">{ICONS.SUCCESS}</span>
                  <p className="text-lg text-neutral-700">
                    Para o profissional que valoriza seu tempo e quer se livrar de tarefas manuais para focar na estratégia.
                  </p>
                </div>
                <div className="flex items-start">
                  <span className="text-accent-500 mr-4 mt-1">{ICONS.SUCCESS}</span>
                  <p className="text-lg text-neutral-700">
                    Para quem entende que um cliente bem informado é um cliente satisfeito e fiel.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Mission and Vision Section */}
          <div className="grid lg:grid-cols-2 gap-8 mb-16">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="font-display font-bold text-2xl text-primary-800 mb-6">
                Nossa Missão
              </h3>
              <p className="text-lg text-neutral-700 leading-relaxed">
                Empoderar advogados e escritórios em todo o Brasil, automatizando tarefas repetitivas com tecnologia intuitiva, para que possam dedicar seu tempo ao exercício estratégico do Direito e à entrega de resultados excepcionais para seus clientes.
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <h3 className="font-display font-bold text-2xl text-primary-800 mb-6">
                Nossa Visão
              </h3>
              <p className="text-lg text-neutral-700 leading-relaxed">
                Ser a principal plataforma de inteligência jurídica do Brasil, transformando a maneira como os serviços legais são gerenciados e entregues, tornando a advocacia mais eficiente, transparente e focada no cliente.
              </p>
            </div>
          </div>

          {/* CTA Section */}
          <div className="text-center">
            <h2 className="font-display font-bold text-3xl text-primary-800 mb-8">
              Comece sua transformação hoje
            </h2>
            <div className="flex gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="bg-accent-500 hover:bg-accent-600 text-white">
                  Testar 7 dias grátis
                  <span className="ml-2">{ICONS.ARROW_RIGHT}</span>
                </Button>
              </Link>
              <Link href="/">
                <Button size="lg" variant="outline">
                  Voltar ao início
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
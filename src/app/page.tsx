import { Navigation } from '../components/landing/navigation';
import { Hero } from '../components/landing/hero';
import { SocialProof } from '../components/landing/social-proof';
import { Features } from '../components/landing/features';
import { HowItWorks } from '../components/landing/how-it-works';
import { ROICalculator } from '../components/landing/roi-calculator';
import { SocialProofMini } from '../components/landing/social-proof-mini';
import { Pricing } from '../components/landing/pricing';
import { CaseStudies } from '../components/landing/case-studies';
import { FAQ } from '../components/landing/faq';
import { FinalCTA } from '../components/landing/final-cta';
import { Footer } from '../components/landing/footer';

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <Navigation />
      <Hero />
      <SocialProof />
      <Features />
      <HowItWorks />
      <ROICalculator />
      <Pricing />
      <SocialProofMini />
      <CaseStudies />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}

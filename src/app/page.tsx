import { Navigation } from '../components/landing/navigation';
import { Hero } from '../components/landing/hero';
import { Features } from '../components/landing/features';
import { HowItWorks } from '../components/landing/how-it-works';
import { ROICalculator } from '../components/landing/roi-calculator';
import { Pricing } from '../components/landing/pricing';
import { Testimonials } from '../components/landing/testimonials';
import { FAQ } from '../components/landing/faq';
import { FinalCTA } from '../components/landing/final-cta';
import { Footer } from '../components/landing/footer';

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navigation />
      <Hero />
      <Features />
      <HowItWorks />
      <ROICalculator />
      <Pricing />
      <Testimonials />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}

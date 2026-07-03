import { SiteNav } from "@/components/landing/SiteNav";
import { Hero } from "@/components/landing/Hero";
import { FeatureBento } from "@/components/landing/FeatureBento";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ClosingCta } from "@/components/landing/ClosingCta";
import { SiteFooter } from "@/components/landing/SiteFooter";

export default function Home() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        <Hero />
        <FeatureBento />
        <HowItWorks />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}

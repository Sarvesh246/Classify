import { HomeExperience } from "@/components/home/home-experience";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <SiteHeader tone="home" />
      <HomeExperience />
    </main>
  );
}

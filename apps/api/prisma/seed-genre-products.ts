/**
 * Seeds the 5 most common SMB genre starter templates (docs/plans
 * smart-onboarding). Every other BusinessType still works via the
 * AI-generation fallback in lib/website-ai.ts -- this just makes the 5
 * most common genres feel intentionally designed on day one instead of
 * always waiting on a live Gemini call.
 *
 * Run manually: npx tsx prisma/seed-genre-products.ts
 * Idempotent -- upserts by `genre`, safe to re-run after editing content.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface GenreSeed {
  genre: string;
  name: string;
  description: string;
  icon: string;
  primaryColor: string;
  font: string;
  badge: string;
  heroTitle: string;
  heroSubtitle: string;
  features: { icon: string; title: string; description: string }[];
  offeringsTitle: string;
}

function heroSection(g: GenreSeed): string {
  return `<section class="relative min-h-[80vh] flex items-center justify-center bg-[#07090e] text-white px-4 sm:px-6 lg:px-8 py-24 overflow-hidden">
  <div class="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-[${g.primaryColor}]/25 via-teal-500/10 to-indigo-500/20 blur-[130px] rounded-full pointer-events-none"></div>
  <div class="relative z-10 max-w-5xl mx-auto text-center">
    <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-xl bg-white/[0.06] border border-white/[0.12] mb-8">
      <span class="w-2 h-2 rounded-full" style="background: {{PRIMARY_COLOR}}; box-shadow: 0 0 10px {{PRIMARY_COLOR}}"></span>
      <span class="text-xs font-semibold uppercase tracking-widest text-gray-300">${g.badge}</span>
    </div>
    <h1 class="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6 text-white">{{TITLE}}</h1>
    <p class="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl mx-auto font-normal leading-relaxed">{{SUBTITLE}}</p>
    <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
      <a href="#offerings" class="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-black shadow-lg transition-all transform hover:-translate-y-0.5" style="background: {{PRIMARY_COLOR}}; box-shadow: 0 0 30px {{PRIMARY_COLOR}}60">{{CTA_PRIMARY}}</a>
      <a href="#contact" class="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold text-white backdrop-blur-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.15] transition-all">{{CTA_SECONDARY}}</a>
    </div>
  </div>
</section>`;
}

function featureGridSection(g: GenreSeed): string {
  const cards = g.features
    .map(
      (f) => `
      <div class="p-8 rounded-3xl bg-white/[0.03] border border-white/[0.08] hover:border-[${g.primaryColor}]/40 transition-all duration-300">
        <div class="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 text-2xl" style="background: {{PRIMARY_COLOR}}20; color: {{PRIMARY_COLOR}}">${f.icon}</div>
        <h3 class="text-xl font-bold text-white mb-3">${f.title}</h3>
        <p class="text-gray-400 text-sm leading-relaxed">${f.description}</p>
      </div>`,
    )
    .join("");

  return `<section id="offerings" class="py-24 bg-[#090c14] text-white px-4 sm:px-6 lg:px-8 border-t border-white/[0.05]">
  <div class="max-w-7xl mx-auto">
    <div class="text-center max-w-3xl mx-auto mb-16">
      <span class="text-xs font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-full" style="color: {{PRIMARY_COLOR}}; background: {{PRIMARY_COLOR}}15; border: 1px solid {{PRIMARY_COLOR}}30">${g.offeringsTitle}</span>
      <h2 class="text-3xl sm:text-5xl font-extrabold text-white mt-4 mb-4 tracking-tight">Why {{TITLE}}</h2>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">${cards}
    </div>
  </div>
</section>`;
}

function contactSection(): string {
  return `<section id="contact" class="py-24 bg-[#07090e] text-white px-4 sm:px-6 lg:px-8 border-t border-white/[0.05]">
  <div class="max-w-5xl mx-auto">
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
      <div class="lg:col-span-5 text-left">
        <span class="text-xs font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-full" style="color: {{PRIMARY_COLOR}}; background: {{PRIMARY_COLOR}}15; border: 1px solid {{PRIMARY_COLOR}}30">Connect</span>
        <h2 class="text-3xl sm:text-5xl font-extrabold text-white mt-4 mb-6 tracking-tight">Get In Touch</h2>
        <p class="text-gray-400 text-sm leading-relaxed mb-8">Have a question or want to book? Reach out and we'll get back to you promptly.</p>
        <div class="space-y-4">
          <div class="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style="background: {{PRIMARY_COLOR}}20; color: {{PRIMARY_COLOR}}">📧</div>
            <div><div class="text-xs text-gray-400">Email</div><div class="text-sm font-semibold text-white">{{EMAIL}}</div></div>
          </div>
          <div class="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">📞</div>
            <div><div class="text-xs text-gray-400">Phone</div><div class="text-sm font-semibold text-white">{{PHONE}}</div></div>
          </div>
        </div>
      </div>
      <div class="lg:col-span-7">
        <div class="p-8 sm:p-10 rounded-3xl bg-white/[0.03] border border-white/[0.1] shadow-2xl">
          <a href="https://wa.me/{{PHONE}}" class="block w-full py-4 rounded-xl font-bold text-black text-center shadow-lg transition-all" style="background: {{PRIMARY_COLOR}}; box-shadow: 0 0 25px {{PRIMARY_COLOR}}50">{{CTA_PRIMARY}} on WhatsApp →</a>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

const GENRES: GenreSeed[] = [
  {
    genre: "RESTAURANT",
    name: "Restaurant / Cafe",
    description: "Menu-forward storefront for restaurants, cafes and diners.",
    icon: "🍽️",
    primaryColor: "#f59e0b",
    font: "Plus Jakarta Sans",
    badge: "Now Serving",
    heroTitle: "{{TITLE}}",
    heroSubtitle: "{{SUBTITLE}}",
    features: [
      { icon: "👨‍🍳", title: "Fresh, Made to Order", description: "Every dish prepared fresh from real ingredients, not reheated." },
      { icon: "📱", title: "Order via WhatsApp", description: "Skip the wait -- message us directly and we'll have it ready." },
      { icon: "🚴", title: "Fast Delivery", description: "Hot food, delivered quickly to your door." },
    ],
    offeringsTitle: "On The Menu",
  },
  {
    genre: "SALON",
    name: "Salon / Spa",
    description: "Booking-forward storefront for salons and spas.",
    icon: "💇",
    primaryColor: "#ec4899",
    font: "Plus Jakarta Sans",
    badge: "Book Your Slot",
    heroTitle: "{{TITLE}}",
    heroSubtitle: "{{SUBTITLE}}",
    features: [
      { icon: "✂️", title: "Expert Stylists", description: "Trained professionals who listen before they cut." },
      { icon: "🧴", title: "Premium Products", description: "Only quality products used on every client." },
      { icon: "📅", title: "Easy Booking", description: "Reserve your slot in seconds, no phone tag." },
    ],
    offeringsTitle: "Our Services",
  },
  {
    genre: "RETAIL_STORE",
    name: "Retail Store",
    description: "Catalog-forward storefront for retail and grocery stores.",
    icon: "🛍️",
    primaryColor: "#10b981",
    font: "Plus Jakarta Sans",
    badge: "Shop Local",
    heroTitle: "{{TITLE}}",
    heroSubtitle: "{{SUBTITLE}}",
    features: [
      { icon: "✅", title: "Verified Quality", description: "Every item checked before it reaches our shelves." },
      { icon: "💰", title: "Fair Pricing", description: "Honest prices, no inflated MRPs." },
      { icon: "🚚", title: "Doorstep Delivery", description: "Order online, delivered same day." },
    ],
    offeringsTitle: "Store Catalog",
  },
  {
    genre: "GYM_FITNESS",
    name: "Gym / Fitness",
    description: "Membership-forward storefront for gyms and fitness studios.",
    icon: "💪",
    primaryColor: "#6366f1",
    font: "Space Grotesk",
    badge: "Train With Us",
    heroTitle: "{{TITLE}}",
    heroSubtitle: "{{SUBTITLE}}",
    features: [
      { icon: "🏋️", title: "Full Equipment", description: "Modern equipment for strength and cardio training." },
      { icon: "🧑‍🏫", title: "Certified Trainers", description: "Real guidance from trainers who track your progress." },
      { icon: "⏰", title: "Flexible Hours", description: "Train on your schedule, not ours." },
    ],
    offeringsTitle: "Memberships & Training",
  },
  {
    genre: "CLINIC",
    name: "Clinic",
    description: "Appointment-forward storefront for clinics and healthcare practices.",
    icon: "🩺",
    primaryColor: "#0ea5e9",
    font: "Plus Jakarta Sans",
    badge: "Book a Consultation",
    heroTitle: "{{TITLE}}",
    heroSubtitle: "{{SUBTITLE}}",
    features: [
      { icon: "👩‍⚕️", title: "Qualified Doctors", description: "Experienced practitioners you can trust." },
      { icon: "🕒", title: "Minimal Wait Times", description: "Book ahead and skip the waiting room." },
      { icon: "🔒", title: "Confidential Care", description: "Your health information stays private." },
    ],
    offeringsTitle: "Consultations & Services",
  },
];

async function main() {
  for (const g of GENRES) {
    const sections = [
      { id: "hero", category: "Hero", name: "Hero", htmlContent: heroSection(g), defaultCta: "Get Started", defaultCtaSecondary: "Contact Us" },
      { id: "features", category: "FeatureGrid", name: "Why Us", htmlContent: featureGridSection(g) },
      { id: "contact", category: "ContactForm", name: "Contact", htmlContent: contactSection() },
    ];

    await prisma.genreProduct.upsert({
      where: { genre: g.genre },
      update: {
        name: g.name,
        description: g.description,
        icon: g.icon,
        defaultTheme: { primaryColor: g.primaryColor, font: g.font, mode: "dark" },
        sections,
      },
      create: {
        genre: g.genre,
        name: g.name,
        description: g.description,
        icon: g.icon,
        defaultTheme: { primaryColor: g.primaryColor, font: g.font, mode: "dark" },
        sections,
        isActive: true,
      },
    });
    console.log(`Seeded GenreProduct: ${g.genre}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });

import type { Business, GenreProduct } from "@prisma/client";
import { prisma } from "./prisma.js";

// Ported from SAAS/backend/src/modules/website/website.service.ts.
// The placeholder product/feature copy below (shown only when a business
// has zero real products/blocks configured) is template filler for an
// empty-state preview, not a business metric misrepresented as real data
// -- unlike the analytics/payments/growth fallback bugs fixed elsewhere in
// this port, nothing here claims to be the business's real numbers.

interface WebsiteBlock {
  type: string;
  props: Record<string, any>;
}

export async function getWebsiteConfig(businessId: string) {
  return prisma.websiteConfig.findUnique({ where: { businessId } });
}

export async function saveWebsiteConfig(businessId: string, data: Record<string, any>) {
  const themeJson =
    typeof data.theme === "object" && data.theme !== null
      ? data.theme
      : { primaryColor: data.primaryColor || "#10b981", font: data.font || "Plus Jakarta Sans", mode: data.storefrontMode || "dark" };

  return prisma.websiteConfig.upsert({
    where: { businessId },
    update: {
      template: data.template || "complete-storefront",
      theme: themeJson,
      heroTitle: data.heroTitle,
      heroSubtitle: data.heroSubtitle,
      heroImage: data.heroImage,
      showProducts: data.showProducts !== false,
      showServices: data.showServices === true,
      showWhatsApp: data.showWhatsApp !== false,
      showReviews: data.showReviews !== false,
      enableOrdering: data.enableOrdering !== false,
      subdomain: data.subdomain,
      customDomain: data.customDomain,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      blocks: data.blocks !== undefined ? data.blocks : undefined,
      isPublished: data.isPublished !== false,
    },
    create: {
      businessId,
      template: data.template || "complete-storefront",
      theme: themeJson,
      heroTitle: data.heroTitle || "Welcome",
      heroSubtitle: data.heroSubtitle || "",
      showProducts: data.showProducts !== false,
      showServices: data.showServices === true,
      showWhatsApp: data.showWhatsApp !== false,
      showReviews: data.showReviews !== false,
      enableOrdering: data.enableOrdering !== false,
      subdomain: data.subdomain,
      customDomain: data.customDomain,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      blocks: data.blocks,
      isPublished: data.isPublished !== false,
    },
  });
}

export interface GenreApplyCustomizations {
  primaryColor?: string;
  font?: string;
  disabledSections?: string[];
  sectionOverrides?: Record<string, { ctaPrimary?: string; ctaSecondary?: string }>;
}

/**
 * Merges a GenreProduct's theme/sections into a business's WebsiteConfig,
 * replacing {{PLACEHOLDER}} tokens with real business fields. Factored out
 * of biz-website.ts's POST /genre-products/:id/apply so the smart-onboarding
 * provisioner (lib/onboarding-provisioner.ts) can call the same logic
 * without going through a business having to already know a GenreProduct id.
 */
export async function applyGenreProductToBusiness(
  business: Business,
  product: GenreProduct,
  customizations: GenreApplyCustomizations = {},
) {
  const defaultTheme = product.defaultTheme as { primaryColor?: string; font?: string; mode?: string };
  const theme = {
    primaryColor: customizations.primaryColor || defaultTheme.primaryColor || "#10b981",
    font: customizations.font || defaultTheme.font || "Plus Jakarta Sans",
    mode: defaultTheme.mode || "dark",
  };

  const sections = product.sections as {
    id?: string;
    htmlContent?: string;
    category?: string;
    name?: string;
    defaultCta?: string;
    defaultCtaSecondary?: string;
  }[];
  const disabledSet = new Set(customizations.disabledSections ?? []);
  const overrides = customizations.sectionOverrides ?? {};

  const blocks = sections
    .filter((s) => !disabledSet.has(s.id ?? ""))
    .map((section, idx) => {
      const sectionOverride = overrides[section.id ?? ""] ?? {};
      let html = section.htmlContent || "";
      html = html
        .replace(/\{\{BUSINESS_NAME\}\}/g, business.name)
        .replace(/\{\{TITLE\}\}/g, business.name)
        .replace(/\{\{SUBTITLE\}\}/g, business.description || "Premium quality, exceptional service.")
        .replace(/\{\{PHONE\}\}/g, business.phone || "+91 98765 43210")
        .replace(/\{\{EMAIL\}\}/g, business.email || "hello@" + (business.slug || "business") + ".com")
        .replace(/\{\{PRIMARY_COLOR\}\}/g, theme.primaryColor)
        .replace(/\{\{CTA_PRIMARY\}\}/g, sectionOverride.ctaPrimary || section.defaultCta || "Get Started")
        .replace(/\{\{CTA_SECONDARY\}\}/g, sectionOverride.ctaSecondary || section.defaultCtaSecondary || "Learn More");

      return {
        id: section.id || `block-${Date.now()}-${idx}`,
        type: "RawHtml",
        order: idx + 1,
        props: { html, originalCategory: section.category, sectionName: section.name, editable: true, ...sectionOverride },
      };
    });

  await prisma.websiteConfig.upsert({
    where: { businessId: business.id },
    update: { theme, blocks, template: "genre-" + product.genre.toLowerCase() },
    create: { businessId: business.id, theme, blocks, template: "genre-" + product.genre.toLowerCase() },
  });

  await prisma.genreProduct.update({ where: { id: product.id }, data: { usageCount: { increment: 1 } } });

  return { theme, blocks };
}

export async function processPublicStorefrontOrder(
  slugOrId: string,
  payload: {
    customerName: string;
    customerPhone: string;
    deliveryAddress?: string;
    items: Array<{ id?: string; name: string; price: number; qty: number }>;
    notes?: string;
  },
) {
  let business = await prisma.business.findUnique({ where: { slug: slugOrId } });
  if (!business) business = await prisma.business.findUnique({ where: { id: slugOrId } });
  if (!business) business = await prisma.business.findFirst({ where: { isActive: true } });
  if (!business) throw new Error("Business not found");

  if (!payload.items || payload.items.length === 0) {
    throw new Error("Cannot create an empty order");
  }

  let subtotal = 0;
  payload.items.forEach((i) => {
    subtotal += i.price * i.qty;
  });
  const deliveryFee = subtotal >= 399 ? 0 : 40;
  const taxAmount = Math.round(subtotal * 0.05);
  const total = subtotal + deliveryFee + taxAmount;

  let customer = await prisma.customer.findFirst({ where: { businessId: business.id, phone: payload.customerPhone } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        businessId: business.id,
        name: payload.customerName || "Online Customer",
        phone: payload.customerPhone,
        address: payload.deliveryAddress,
        segment: "NEW",
        totalOrders: 1,
        lifetimeValue: total,
        lastOrderAt: new Date(),
      },
    });
  } else {
    customer = await prisma.customer.update({
      where: { id: customer.id },
      data: {
        totalOrders: { increment: 1 },
        lifetimeValue: { increment: total },
        lastOrderAt: new Date(),
        address: payload.deliveryAddress || customer.address,
      },
    });
  }

  const defaultProduct = await prisma.product.findFirst({ where: { businessId: business.id } });
  let defaultProdId = defaultProduct?.id;
  if (!defaultProdId) {
    const createdFallback = await prisma.product.create({
      data: { businessId: business.id, name: "General Store Item", slug: `general-item-${Date.now()}`, price: 100 },
    });
    defaultProdId = createdFallback.id;
  }

  const orderCount = await prisma.order.count({ where: { businessId: business.id } });
  const orderNumber = `#${1001 + orderCount}`;

  const order = await prisma.order.create({
    data: {
      businessId: business.id,
      orderNumber,
      customerId: customer.id,
      status: "CONFIRMED",
      source: "WEBSITE",
      subtotal,
      deliveryFee,
      taxAmount,
      total,
      deliveryAddress: payload.deliveryAddress,
      customerNotes: payload.notes,
      items: {
        create: payload.items.map((item) => ({
          productId: item.id && item.id.length > 20 ? item.id : defaultProdId!,
          productName: item.name,
          productPrice: item.price,
          unitPrice: item.price,
          quantity: item.qty,
          total: item.price * item.qty,
        })),
      },
    },
    include: { items: true, customer: true },
  });

  return {
    order,
    businessName: business.name,
    whatsappUrl: `https://wa.me/${business.phone?.replace(/\D/g, "") || "919876543210"}?text=Hi! I have placed Order ${orderNumber} on your website for ₹${total}. Please confirm!`,
  };
}

export async function generateWebsiteHTML(businessId: string): Promise<string> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      products: { take: 24, where: { isActive: true }, orderBy: { totalSold: "desc" } },
      services: { take: 8, where: { isActive: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!business) throw new Error("Business not found");

  const config = await prisma.websiteConfig.findUnique({ where: { businessId } });
  const themeObj = (config?.theme as Record<string, string>) || {};
  const primaryColor = themeObj.primaryColor || "#10b981";
  const font = themeObj.font || "Plus Jakarta Sans";
  const blocks: WebsiteBlock[] = Array.isArray(config?.blocks) ? (config!.blocks as unknown as WebsiteBlock[]) : [];

  let blocksHtml = "";

  for (const block of blocks) {
    if (block.type === "RawHtml") {
      let html = block.props.html || "";
      html = html
        .replace(/{{PRIMARY_COLOR}}/g, primaryColor)
        .replace(/{{TITLE}}/g, business.name)
        .replace(/{{SUBTITLE}}/g, business.description || "Elevate your everyday experience with our curated premium offerings.")
        .replace(/{{CTA_PRIMARY}}/g, "Explore Collection")
        .replace(/{{CTA_SECONDARY}}/g, "Contact Concierge")
        .replace(/{{SECTION_TITLE}}/g, "Engineered for Perfection")
        .replace(/{{FEATURE_TITLE}}/g, "Artisan Craftsmanship & Precision")
        .replace(/{{FEATURE_DESC}}/g, "Every detail is meticulously crafted to ensure the highest standard of satisfaction.")
        .replace(/{{EMAIL}}/g, business.email || "support@" + (business.slug || "business") + ".com");
      blocksHtml += html;
    } else if (block.type === "Hero") {
      blocksHtml += `
        <section class="relative min-h-[80vh] flex items-center justify-center bg-[#07090e] text-white px-4 sm:px-6 lg:px-8 py-24 overflow-hidden">
          <div class="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-gradient-to-tr from-[${primaryColor}]/25 via-teal-500/10 to-indigo-500/20 blur-[130px] rounded-full pointer-events-none"></div>
          <div class="relative z-10 max-w-5xl mx-auto text-center">
            <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full backdrop-blur-xl bg-white/[0.06] border border-white/[0.12] mb-8">
              <span class="w-2 h-2 rounded-full" style="background: ${primaryColor}; box-shadow: 0 0 10px ${primaryColor}"></span>
              <span class="text-xs font-semibold uppercase tracking-widest text-gray-300">${block.props.badge || "Top Rated Experience"}</span>
            </div>
            <h1 class="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6 text-white">
              ${block.props.title || business.name}
            </h1>
            <p class="text-lg sm:text-xl text-gray-400 mb-10 max-w-2xl mx-auto font-normal leading-relaxed">
              ${block.props.subtitle || business.description || "Discover superior quality and exceptional service tailored for you."}
            </p>
            <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="#products" class="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-black shadow-lg transition-all transform hover:-translate-y-0.5" style="background: ${primaryColor}; box-shadow: 0 0 30px ${primaryColor}60">
                ${block.props.ctaPrimary || "Get Started Now"}
              </a>
              <a href="#contact" class="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold text-white backdrop-blur-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.15] transition-all">
                ${block.props.ctaSecondary || "Learn More"}
              </a>
            </div>
          </div>
        </section>
      `;
    } else if (block.type === "FeatureGrid") {
      const features = block.props.features || [
        { title: "Premium Grade Quality", description: "Engineered with authentic materials and verified standards." },
        { title: "Lightning Fast Support", description: "Instant responses directly through our dedicated WhatsApp concierge." },
        { title: "Secure & Transparent", description: "Safe, encrypted transactions with instant digital invoicing." },
      ];
      blocksHtml += `
        <section id="features" class="py-24 bg-[#090c14] text-white px-4 sm:px-6 lg:px-8 border-t border-white/[0.05]">
          <div class="max-w-7xl mx-auto">
            <div class="text-center max-w-3xl mx-auto mb-16">
              <span class="text-xs font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-full" style="color: ${primaryColor}; background: ${primaryColor}15; border: 1px solid ${primaryColor}30">Why Choose Us</span>
              <h2 class="text-3xl sm:text-5xl font-extrabold text-white mt-4 mb-4 tracking-tight">Crafted for Excellence</h2>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              ${features
                .map(
                  (f: any, idx: number) => `
                <div class="p-8 rounded-3xl bg-white/[0.03] border border-white/[0.08] hover:border-[${primaryColor}]/40 transition-all duration-300 group hover:shadow-[0_0_30px_${primaryColor}20]">
                  <div class="w-12 h-12 rounded-2xl flex items-center justify-center mb-6 text-2xl group-hover:scale-110 transition-transform" style="background: ${primaryColor}20; color: ${primaryColor}">
                    ${["💎", "⚡", "🛡️"][idx % 3]}
                  </div>
                  <h3 class="text-xl font-bold text-white mb-3">${f.title}</h3>
                  <p class="text-gray-400 text-sm leading-relaxed">${f.description}</p>
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
        </section>
      `;
    } else if (block.type === "Products") {
      const prods =
        business.products.length > 0
          ? business.products
          : [
              { id: "p1", name: "Signature Premium Edition", price: 999, description: "Handcrafted luxury experience" },
              { id: "p2", name: "Deluxe Comfort Package", price: 1799, description: "All-inclusive comprehensive solution" },
              { id: "p3", name: "Essential Starter Kit", price: 549, description: "Top rated basic necessity" },
              { id: "p4", name: "Executive Master Tier", price: 2999, description: "Bespoke custom personalized delivery" },
            ];
      blocksHtml += `
        <section id="products" class="py-24 bg-[#07090e] text-white px-4 sm:px-6 lg:px-8 border-t border-white/[0.05]">
          <div class="max-w-7xl mx-auto">
            <div class="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
              <div>
                <span class="text-xs font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-full" style="color: ${primaryColor}; background: ${primaryColor}15; border: 1px solid ${primaryColor}30">Store Catalog</span>
                <h2 class="text-3xl sm:text-5xl font-extrabold text-white mt-4 tracking-tight">${block.props.title || "Featured Offerings"}</h2>
              </div>
              <p class="text-gray-400 text-sm max-w-md">Browse our certified collection and order instantly with 1-click checkout.</p>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              ${prods
                .map(
                  (p: any, i: number) => `
                <div class="group relative rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-[${primaryColor}]/50 p-5 transition-all duration-300 flex flex-col justify-between hover:shadow-[0_0_30px_${primaryColor}20]">
                  <div>
                    <div class="relative aspect-square rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] flex items-center justify-center text-5xl mb-4 overflow-hidden">
                      <span class="transform group-hover:scale-110 transition-transform">${["📦", "✨", "💎", "🌟"][i % 4]}</span>
                      <span class="absolute top-2 right-2 text-[10px] font-black px-2 py-0.5 rounded-full text-black" style="background: ${primaryColor}">HOT</span>
                    </div>
                    <div class="text-xs font-semibold mb-1" style="color: ${primaryColor}">In Stock</div>
                    <h3 class="font-bold text-lg text-white group-hover:text-gray-200 transition-colors">${p.name}</h3>
                    <p class="text-gray-400 text-xs mt-1 line-clamp-2">${p.description || "Verified authentic quality."}</p>
                  </div>
                  <div class="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                    <div>
                      <div class="text-xl font-extrabold" style="color: ${primaryColor}">₹${p.price}</div>
                    </div>
                    <button onclick="addToCart('${p.name}', ${p.price})" class="px-4 py-2 rounded-lg text-black font-bold text-xs transition-all transform hover:scale-105" style="background: ${primaryColor}; box-shadow: 0 0 15px ${primaryColor}50">
                      Add to Cart +
                    </button>
                  </div>
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
        </section>
      `;
    } else if (block.type === "ContactForm") {
      blocksHtml += `
        <section id="contact" class="py-24 bg-[#090c14] text-white px-4 sm:px-6 lg:px-8 border-t border-white/[0.05] relative overflow-hidden">
          <div class="max-w-5xl mx-auto relative z-10">
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div class="lg:col-span-5 text-left">
                <span class="text-xs font-bold uppercase tracking-widest px-3.5 py-1.5 rounded-full" style="color: ${primaryColor}; background: ${primaryColor}15; border: 1px solid ${primaryColor}30">Connect</span>
                <h2 class="text-3xl sm:text-5xl font-extrabold text-white mt-4 mb-6 tracking-tight">${block.props.title || "Get In Touch"}</h2>
                <p class="text-gray-400 text-sm leading-relaxed mb-8">Have inquiries or custom orders? Reach out directly and we will respond promptly.</p>
                <div class="space-y-4">
                  <div class="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style="background: ${primaryColor}20; color: ${primaryColor}">📧</div>
                    <div>
                      <div class="text-xs text-gray-400">Email Address</div>
                      <div class="text-sm font-semibold text-white">${block.props.email || business.email || "support@example.com"}</div>
                    </div>
                  </div>
                  <div class="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">📞</div>
                    <div>
                      <div class="text-xs text-gray-400">Phone Support</div>
                      <div class="text-sm font-semibold text-white">${business.phone || "+91 98765 43210"}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div class="lg:col-span-7">
                <div class="p-8 sm:p-10 rounded-3xl bg-white/[0.03] border border-white/[0.1] backdrop-blur-2xl shadow-2xl">
                  <form class="space-y-4" onsubmit="event.preventDefault(); alert('Thank you! Your message has been received.');">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">Name</label>
                        <input type="text" required class="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white placeholder-gray-500 outline-none text-sm focus:border-[${primaryColor}]" placeholder="Your name">
                      </div>
                      <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">Phone</label>
                        <input type="tel" required class="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white placeholder-gray-500 outline-none text-sm focus:border-[${primaryColor}]" placeholder="Phone / WhatsApp">
                      </div>
                    </div>
                    <div>
                      <label class="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">Message</label>
                      <textarea rows="3" required class="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white placeholder-gray-500 outline-none text-sm focus:border-[${primaryColor}]" placeholder="How can we assist you?"></textarea>
                    </div>
                    <button type="submit" class="w-full py-4 rounded-xl font-bold text-black shadow-lg transition-all" style="background: ${primaryColor}; box-shadow: 0 0 25px ${primaryColor}50">
                      Send Inquiry Now →
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>
      `;
    }
  }

  if (blocks.length === 0) {
    blocksHtml = `
      <section class="relative min-h-[85vh] flex items-center justify-center bg-[#07090e] text-white px-4 sm:px-6 lg:px-8 py-24 overflow-hidden text-center">
        <div class="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/20 blur-[130px] rounded-full pointer-events-none"></div>
        <div class="relative z-10 max-w-4xl mx-auto">
          <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-xl bg-white/[0.05] border border-white/[0.1] shadow-2xl mb-8">
            <span class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#10b981]"></span>
            <span class="text-xs font-semibold uppercase tracking-widest text-emerald-300">Verified Digital Storefront</span>
          </div>
          <h1 class="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-8 text-white">
            Welcome to <span class="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">${business.name}</span>
          </h1>
          <p class="text-lg sm:text-xl text-gray-400 mb-12 max-w-2xl mx-auto font-normal leading-relaxed">
            ${business.description || "Premium products, transparent pricing, and instant doorstep delivery."}
          </p>
          <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#products" class="px-8 py-4 rounded-xl font-bold text-black bg-gradient-to-r from-emerald-400 to-teal-300 shadow-[0_0_30px_rgba(16,185,129,0.35)] transition-all">Explore Offerings</a>
            <a href="#contact" class="px-8 py-4 rounded-xl font-semibold text-white bg-white/[0.05] border border-white/[0.15] transition-all">Contact Us</a>
          </div>
        </div>
      </section>
    `;
  }

  const whatsappPhone = business.phone ? business.phone.replace(/\D/g, "") : "919876543210";

  return `<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${config?.metaTitle || business.name} — Storefront</title>
  <meta name="description" content="${config?.metaDescription || business.description || "Official digital store."}"/>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: { sans: ['${font}', 'Plus Jakarta Sans', 'sans-serif'] },
          colors: { primary: '${primaryColor}' }
        }
      }
    }
  </script>
  <style>
    body { background: #07090e; color: #f8fafc; }
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #07090e; }
    ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: #334155; }
  </style>
</head>
<body class="font-sans antialiased selection:bg-emerald-500/20 selection:text-emerald-300 min-h-screen flex flex-col justify-between">

  <main class="flex-1 w-full">
    ${blocksHtml}
  </main>

  <a href="https://wa.me/${whatsappPhone}?text=Hi%20${encodeURIComponent(business.name)}!%20I%20am%20visiting%20your%20store%20and%20need%20assistance." target="_blank" class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:scale-105 transition-all">
    <span class="text-xl">💬</span>
    <span class="text-sm">WhatsApp Us</span>
    <span class="w-2 h-2 rounded-full bg-white animate-ping"></span>
  </a>

  <div id="cart-drawer" class="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#090c14] border-l border-white/[0.1] shadow-2xl p-6 transform translate-x-full transition-transform duration-300 flex flex-col justify-between">
    <div>
      <div class="flex items-center justify-between border-b border-white/[0.08] pb-4 mb-6">
        <h3 class="font-extrabold text-xl text-white">Your Shopping Cart</h3>
        <button onclick="toggleCart()" class="text-gray-400 hover:text-white text-2xl font-bold">×</button>
      </div>
      <div id="cart-items" class="space-y-3 overflow-y-auto max-h-[60vh] text-sm text-gray-300">
        <p class="text-center text-gray-500 py-10">Your cart is currently empty.</p>
      </div>
    </div>
    <div class="border-t border-white/[0.08] pt-4">
      <div class="flex justify-between items-center text-lg font-extrabold text-white mb-4">
        <span>Total:</span>
        <span id="cart-total" style="color: ${primaryColor}">₹0</span>
      </div>
      <button onclick="checkoutWhatsApp()" class="w-full py-4 rounded-xl font-bold text-black shadow-lg transition-all" style="background: ${primaryColor}">
        Proceed to WhatsApp Checkout →
      </button>
    </div>
  </div>

  <script>
    let cart = [];
    function addToCart(name, price) {
      cart.push({ name, price });
      updateCart();
      alert('Added ' + name + ' to cart!');
    }
    function toggleCart() {
      const el = document.getElementById('cart-drawer');
      el.classList.toggle('translate-x-full');
    }
    function updateCart() {
      document.getElementById('cart-count').innerText = cart.length;
      const itemsEl = document.getElementById('cart-items');
      if (cart.length === 0) {
        itemsEl.innerHTML = '<p class="text-center text-gray-500 py-10">Your cart is currently empty.</p>';
        document.getElementById('cart-total').innerText = '₹0';
        return;
      }
      let total = 0;
      itemsEl.innerHTML = cart.map((item, i) => {
        total += item.price;
        return '<div class="flex justify-between items-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"><span>' + item.name + '</span><span class="font-bold text-emerald-400">₹' + item.price + '</span></div>';
      }).join('');
      document.getElementById('cart-total').innerText = '₹' + total;
    }
    function checkoutWhatsApp() {
      if (cart.length === 0) return alert('Cart is empty!');
      const itemsList = cart.map(i => i.name + ' (₹' + i.price + ')').join(', ');
      const total = cart.reduce((s, i) => s + i.price, 0);
      const msg = 'Hi! I would like to order: ' + itemsList + '. Total: ₹' + total + '. Please confirm!';
      window.open('https://wa.me/${whatsappPhone}?text=' + encodeURIComponent(msg), '_blank');
    }
  </script>
</body>
</html>`;
}

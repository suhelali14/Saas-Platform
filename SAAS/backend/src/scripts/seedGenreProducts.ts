import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });
const prisma = new PrismaClient();

const genreProducts = [
  {
    genre: 'SALON',
    name: 'Luxury Salon & Spa Solution',
    description: 'A premium, relaxing experience designed for beauty and wellness businesses. Includes services menu, therapist profiles, and instant WhatsApp booking.',
    thumbnail: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80',
    icon: '💆‍♀️',
    defaultTheme: { primaryColor: '#f43f5e', font: 'Outfit', mode: 'dark' },
    sections: [
      {
        id: 'salon-header',
        category: 'Header',
        name: 'Salon Header',
        defaultTitle: 'Luxe Salon',
        defaultCta: 'Book Appointment',
        htmlContent: `
          <header class="sticky top-0 z-50 backdrop-blur-2xl bg-[#0a0505]/90 border-b border-rose-900/30 p-4 flex justify-between items-center text-white">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-rose-500 to-pink-500 flex items-center justify-center font-black text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]">✨</div>
              <div class="font-bold text-xl tracking-wide">{{TITLE}}</div>
            </div>
            <nav class="hidden md:flex gap-8 text-sm font-medium text-rose-200">
              <a href="#services" class="hover:text-white transition-colors">Our Services</a>
              <a href="#team" class="hover:text-white transition-colors">Specialists</a>
              <a href="#contact" class="hover:text-white transition-colors">Location</a>
            </nav>
            <a href="#contact" class="px-5 py-2.5 rounded-full bg-rose-500 hover:bg-rose-400 text-white text-sm font-bold shadow-[0_0_15px_rgba(244,63,94,0.4)] transition-all">{{CTA_PRIMARY}}</a>
          </header>
        `
      },
      {
        id: 'salon-hero',
        category: 'Hero',
        name: 'Spa Hero Banner',
        defaultTitle: 'Indulge in Pure Relaxation',
        defaultSubtitle: 'Experience world-class beauty and wellness treatments tailored to rejuvenate your mind, body, and soul.',
        defaultCta: 'View Our Services',
        htmlContent: `
          <section class="relative min-h-[80vh] flex items-center justify-center bg-[#0a0505] text-white px-4 py-24 overflow-hidden text-center">
            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-rose-500/10 blur-[120px] rounded-full pointer-events-none"></div>
            <div class="relative z-10 max-w-4xl mx-auto">
              <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs font-semibold uppercase tracking-widest mb-8">
                <span class="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span> Signature Experience
              </div>
              <h1 class="text-5xl sm:text-7xl font-light tracking-tight mb-6 leading-tight text-white font-serif">
                {{TITLE}}
              </h1>
              <p class="text-lg text-rose-100/70 mb-10 max-w-2xl mx-auto leading-relaxed">
                {{SUBTITLE}}
              </p>
              <a href="#services" class="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-rose-950 font-bold hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                {{CTA_PRIMARY}} <span>→</span>
              </a>
            </div>
          </section>
        `
      },
      {
        id: 'salon-services',
        category: 'ServiceMenu',
        name: 'Services Menu',
        defaultTitle: 'Signature Treatments',
        defaultSubtitle: 'Curated beauty and wellness therapies.',
        htmlContent: `
          <section id="services" class="py-24 bg-[#0a0505] px-4 border-t border-rose-900/20">
            <div class="max-w-5xl mx-auto">
              <div class="text-center mb-16">
                <h2 class="text-3xl sm:text-4xl font-serif text-white mb-4">{{TITLE}}</h2>
                <p class="text-rose-200/60">{{SUBTITLE}}</p>
              </div>
              <div class="grid gap-6 md:grid-cols-2">
                <div class="p-6 rounded-2xl border border-rose-900/30 bg-rose-950/10 hover:bg-rose-950/30 transition-colors flex justify-between items-center group">
                  <div>
                    <h3 class="text-xl font-medium text-white mb-1 group-hover:text-rose-400 transition-colors">Luxury Facial Spa</h3>
                    <p class="text-sm text-rose-200/50">60 mins • Deep cleansing & glow</p>
                  </div>
                  <div class="text-xl font-serif text-rose-300">₹2,499</div>
                </div>
                <div class="p-6 rounded-2xl border border-rose-900/30 bg-rose-950/10 hover:bg-rose-950/30 transition-colors flex justify-between items-center group">
                  <div>
                    <h3 class="text-xl font-medium text-white mb-1 group-hover:text-rose-400 transition-colors">Bridal Makeup Package</h3>
                    <p class="text-sm text-rose-200/50">180 mins • Complete transformation</p>
                  </div>
                  <div class="text-xl font-serif text-rose-300">₹14,999</div>
                </div>
                <div class="p-6 rounded-2xl border border-rose-900/30 bg-rose-950/10 hover:bg-rose-950/30 transition-colors flex justify-between items-center group">
                  <div>
                    <h3 class="text-xl font-medium text-white mb-1 group-hover:text-rose-400 transition-colors">Aromatherapy Massage</h3>
                    <p class="text-sm text-rose-200/50">90 mins • Full body relaxation</p>
                  </div>
                  <div class="text-xl font-serif text-rose-300">₹3,499</div>
                </div>
                <div class="p-6 rounded-2xl border border-rose-900/30 bg-rose-950/10 hover:bg-rose-950/30 transition-colors flex justify-between items-center group">
                  <div>
                    <h3 class="text-xl font-medium text-white mb-1 group-hover:text-rose-400 transition-colors">Premium Hair Styling</h3>
                    <p class="text-sm text-rose-200/50">45 mins • Wash, cut & blowdry</p>
                  </div>
                  <div class="text-xl font-serif text-rose-300">₹1,299</div>
                </div>
              </div>
            </div>
          </section>
        `
      }
    ]
  },
  {
    genre: 'RESTAURANT',
    name: 'Gourmet Restaurant & Cafe',
    description: 'A mouth-watering digital presence for food businesses. Features a beautiful food menu, chef spotlight, and WhatsApp table reservation.',
    thumbnail: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
    icon: '🍽️',
    defaultTheme: { primaryColor: '#f59e0b', font: 'Space Grotesk', mode: 'dark' },
    sections: [
      {
        id: 'resto-header',
        category: 'Header',
        name: 'Restaurant Header',
        defaultTitle: 'Grand Cafe',
        defaultCta: 'Reserve Table',
        htmlContent: `
          <header class="sticky top-0 z-50 backdrop-blur-xl bg-black/80 border-b border-amber-900/30 p-4 flex justify-between items-center text-white">
            <div class="font-black text-2xl tracking-tighter text-amber-500 uppercase">{{TITLE}}</div>
            <nav class="hidden md:flex gap-8 text-sm font-bold text-gray-300 uppercase tracking-widest">
              <a href="#menu" class="hover:text-amber-500 transition-colors">Menu</a>
              <a href="#about" class="hover:text-amber-500 transition-colors">Our Story</a>
              <a href="#contact" class="hover:text-amber-500 transition-colors">Location</a>
            </nav>
            <a href="#contact" class="px-6 py-2.5 rounded border-2 border-amber-500 text-amber-500 hover:bg-amber-500 hover:text-black text-sm font-black uppercase transition-all">{{CTA_PRIMARY}}</a>
          </header>
        `
      },
      {
        id: 'resto-hero',
        category: 'Hero',
        name: 'Food Hero Banner',
        defaultTitle: 'Taste the Extraordinary',
        defaultSubtitle: 'Authentic flavors crafted with passion and the finest ingredients.',
        defaultCta: 'View Menu',
        htmlContent: `
          <section class="relative min-h-[85vh] flex items-center justify-center bg-[#050505] text-white px-4 py-24 overflow-hidden text-center">
            <div class="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1920&q=80')] bg-cover bg-center"></div>
            <div class="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent"></div>
            
            <div class="relative z-10 max-w-4xl mx-auto">
              <h1 class="text-6xl sm:text-8xl font-black tracking-tighter mb-6 uppercase text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                {{TITLE}}
              </h1>
              <p class="text-xl text-gray-300 mb-10 max-w-2xl mx-auto font-medium">
                {{SUBTITLE}}
              </p>
              <a href="#menu" class="inline-block px-10 py-4 bg-amber-500 text-black font-black uppercase tracking-widest hover:bg-amber-400 transition-colors shadow-[0_0_20px_rgba(245,158,11,0.3)]">
                {{CTA_PRIMARY}}
              </a>
            </div>
          </section>
        `
      },
      {
        id: 'resto-menu',
        category: 'FoodMenu',
        name: 'Digital Food Menu',
        defaultTitle: 'Chef\'s Specials',
        defaultSubtitle: 'Discover our most loved dishes.',
        htmlContent: `
          <section id="menu" class="py-24 bg-[#050505] px-4 border-t border-amber-900/20">
            <div class="max-w-6xl mx-auto">
              <div class="text-center mb-16">
                <span class="text-amber-500 font-bold tracking-widest uppercase text-sm mb-2 block">Menu</span>
                <h2 class="text-4xl sm:text-5xl font-black text-white uppercase">{{TITLE}}</h2>
                <p class="text-gray-400 mt-4">{{SUBTITLE}}</p>
              </div>
              
              <div class="grid md:grid-cols-2 gap-x-16 gap-y-12">
                <!-- Menu Item -->
                <div class="flex gap-4 group cursor-pointer">
                  <div class="w-24 h-24 rounded-lg bg-gray-900 overflow-hidden shrink-0">
                    <img src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&q=80" class="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                  </div>
                  <div class="flex-1">
                    <div class="flex justify-between items-baseline mb-1 border-b border-gray-800 pb-1">
                      <h3 class="text-lg font-bold text-white group-hover:text-amber-500 transition-colors">Truffle Mushroom Risotto</h3>
                      <span class="text-amber-500 font-bold ml-4">₹649</span>
                    </div>
                    <p class="text-sm text-gray-400">Arborio rice, wild mushrooms, parmesan crisp, truffle oil</p>
                  </div>
                </div>
                
                <!-- Menu Item -->
                <div class="flex gap-4 group cursor-pointer">
                  <div class="w-24 h-24 rounded-lg bg-gray-900 overflow-hidden shrink-0">
                    <img src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200&q=80" class="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                  </div>
                  <div class="flex-1">
                    <div class="flex justify-between items-baseline mb-1 border-b border-gray-800 pb-1">
                      <h3 class="text-lg font-bold text-white group-hover:text-amber-500 transition-colors">Woodfired Margherita</h3>
                      <span class="text-amber-500 font-bold ml-4">₹499</span>
                    </div>
                    <p class="text-sm text-gray-400">San Marzano tomatoes, fresh mozzarella, basil, olive oil</p>
                  </div>
                </div>
              </div>
              
              <div class="text-center mt-16">
                <a href="#contact" class="inline-block px-8 py-3 border border-amber-500/50 text-amber-500 font-bold hover:bg-amber-500 hover:text-black transition-colors uppercase tracking-widest text-sm">Order on WhatsApp</a>
              </div>
            </div>
          </section>
        `
      }
    ]
  },
  {
    genre: 'D2C_BRAND',
    name: 'Modern D2C E-Commerce',
    description: 'High-converting storefront for modern fashion, apparel, and lifestyle brands. Includes lookbook, product grid, and fast checkout.',
    thumbnail: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80',
    icon: '🛍️',
    defaultTheme: { primaryColor: '#000000', font: 'Inter', mode: 'light' },
    sections: [
      {
        id: 'd2c-header',
        category: 'Header',
        name: 'Brand Header',
        defaultTitle: 'BRAND.',
        defaultCta: 'Shop Now',
        htmlContent: `
          <header class="sticky top-0 z-50 bg-white border-b border-gray-100 p-4 flex justify-between items-center text-black">
            <div class="flex items-center gap-6">
              <div class="font-black text-2xl tracking-tighter">{{TITLE}}</div>
              <nav class="hidden md:flex gap-6 text-sm font-semibold text-gray-600">
                <a href="#new" class="hover:text-black transition-colors">New Arrivals</a>
                <a href="#bestsellers" class="hover:text-black transition-colors">Bestsellers</a>
              </nav>
            </div>
            <div class="flex items-center gap-4">
              <button onclick="toggleCart && toggleCart()" class="text-sm font-bold flex items-center gap-2">
                CART (0)
              </button>
            </div>
          </header>
        `
      },
      {
        id: 'd2c-hero',
        category: 'Hero',
        name: 'Lookbook Hero',
        defaultTitle: 'The New Minimal Collection',
        defaultSubtitle: 'Elevate your everyday wardrobe with our latest sustainable essentials.',
        defaultCta: 'Shop Collection',
        htmlContent: `
          <section class="relative min-h-[70vh] flex items-center justify-start bg-gray-100 text-black px-4 sm:px-12 py-24 overflow-hidden">
            <div class="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1920&q=80')] bg-cover bg-center opacity-40"></div>
            
            <div class="relative z-10 max-w-2xl bg-white/90 backdrop-blur-sm p-10 sm:p-14">
              <h1 class="text-5xl sm:text-7xl font-black tracking-tighter mb-6 uppercase">
                {{TITLE}}
              </h1>
              <p class="text-lg text-gray-600 mb-10 font-medium">
                {{SUBTITLE}}
              </p>
              <a href="#products" class="inline-block px-10 py-4 bg-black text-white font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors">
                {{CTA_PRIMARY}} →
              </a>
            </div>
          </section>
        `
      }
    ]
  },
  {
    genre: 'CLINIC',
    name: 'Healthcare & Clinic',
    description: 'Professional, trustworthy design for doctors, clinics, and pharmacies. Focuses on treatments and easy appointment booking.',
    thumbnail: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=600&q=80',
    icon: '🏥',
    defaultTheme: { primaryColor: '#2563eb', font: 'Plus Jakarta Sans', mode: 'light' },
    sections: [
      {
        id: 'clinic-header',
        category: 'Header',
        name: 'Clinic Header',
        defaultTitle: 'CityCare Medical',
        defaultCta: 'Book Appointment',
        htmlContent: `
          <header class="sticky top-0 z-50 bg-white border-b border-blue-100 p-4 flex justify-between items-center text-slate-900 shadow-sm">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xl font-bold">+</div>
              <div class="font-extrabold text-xl">{{TITLE}}</div>
            </div>
            <nav class="hidden md:flex gap-6 text-sm font-semibold text-slate-600">
              <a href="#services" class="hover:text-blue-600 transition-colors">Treatments</a>
              <a href="#doctors" class="hover:text-blue-600 transition-colors">Doctors</a>
            </nav>
            <a href="#contact" class="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-600/20 transition-all">{{CTA_PRIMARY}}</a>
          </header>
        `
      },
      {
        id: 'clinic-hero',
        category: 'Hero',
        name: 'Trust Banner',
        defaultTitle: 'Expert Care You Can Trust',
        defaultSubtitle: 'Comprehensive healthcare services for you and your family, delivered by experienced professionals.',
        defaultCta: 'Consult Doctor Online',
        htmlContent: `
          <section class="relative bg-blue-50 text-slate-900 px-4 sm:px-8 py-20 overflow-hidden">
            <div class="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
              <div>
                <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wide mb-6">
                  ⭐ ISO Certified Clinic
                </div>
                <h1 class="text-4xl sm:text-5xl font-extrabold tracking-tight mb-6 leading-tight">
                  {{TITLE}}
                </h1>
                <p class="text-lg text-slate-600 mb-8 leading-relaxed">
                  {{SUBTITLE}}
                </p>
                <div class="flex gap-4">
                  <a href="#contact" class="px-6 py-3 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all">
                    {{CTA_PRIMARY}}
                  </a>
                  <a href="tel:{{PHONE}}" class="px-6 py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-bold hover:border-blue-600 hover:text-blue-600 transition-all flex items-center gap-2">
                    📞 Call {{PHONE}}
                  </a>
                </div>
              </div>
              <div class="hidden md:block relative">
                <div class="absolute inset-0 bg-blue-600 rounded-3xl translate-x-4 translate-y-4 opacity-10"></div>
                <img src="https://images.unsplash.com/photo-1551076805-e18690c5e53b?w=800&q=80" class="rounded-3xl relative z-10 shadow-2xl object-cover h-[400px] w-full" />
              </div>
            </div>
          </section>
        `
      }
    ]
  },
  {
    genre: 'GYM_FITNESS',
    name: 'Fitness Studio & Gym',
    description: 'High-energy design for fitness centers. Focuses on membership plans, trainers, and motivational imagery.',
    thumbnail: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=600&q=80',
    icon: '🏋️',
    defaultTheme: { primaryColor: '#bef264', font: 'Space Grotesk', mode: 'dark' },
    sections: [
      {
        id: 'gym-hero',
        category: 'Hero',
        name: 'Gym Hero',
        defaultTitle: 'Push Your Limits',
        defaultSubtitle: 'State-of-the-art equipment, expert trainers, and a community that pushes you to be your best.',
        defaultCta: 'Join Now',
        htmlContent: `
          <section class="relative min-h-screen flex items-center bg-black text-white px-4 sm:px-8 py-24 overflow-hidden">
            <div class="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1920&q=80')] bg-cover bg-center opacity-30"></div>
            <div class="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent"></div>
            
            <div class="relative z-10 max-w-3xl border-l-8 border-lime-400 pl-8">
              <h1 class="text-6xl sm:text-8xl font-black tracking-tighter mb-6 uppercase italic">
                {{TITLE}}
              </h1>
              <p class="text-xl text-gray-300 mb-10 font-medium max-w-xl">
                {{SUBTITLE}}
              </p>
              <a href="#contact" class="inline-block px-12 py-5 bg-lime-400 text-black font-black uppercase tracking-widest text-lg hover:bg-white transition-colors transform hover:skew-x-[-10deg]">
                {{CTA_PRIMARY}}
              </a>
            </div>
          </section>
        `
      }
    ]
  },
  {
    genre: 'RETAIL_STORE',
    name: 'Retail & Grocery Store',
    description: 'Practical, fast, and conversion-optimized layout for local grocery, electronics, and standard retail stores.',
    thumbnail: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?auto=format&fit=crop&w=600&q=80',
    icon: '🛒',
    defaultTheme: { primaryColor: '#16a34a', font: 'Inter', mode: 'light' },
    sections: [
      {
        id: 'retail-hero',
        category: 'Hero',
        name: 'Retail Hero Banner',
        defaultTitle: 'Fresh Groceries Delivered Fast',
        defaultSubtitle: 'Shop your daily needs, fresh produce, and household essentials. Free delivery on orders above ₹499.',
        defaultCta: 'Start Shopping',
        htmlContent: `
          <section class="bg-green-50 px-4 sm:px-8 py-16 text-slate-900 border-b border-green-100">
            <div class="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-10">
              <div class="flex-1 text-center md:text-left">
                <h1 class="text-4xl md:text-6xl font-black tracking-tight mb-4 text-green-800">{{TITLE}}</h1>
                <p class="text-lg text-slate-600 mb-8 max-w-md mx-auto md:mx-0">{{SUBTITLE}}</p>
                <a href="#products" class="inline-block px-8 py-4 bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-600/30 hover:bg-green-700 transition-colors">
                  {{CTA_PRIMARY}}
                </a>
              </div>
              <div class="flex-1 grid grid-cols-2 gap-4">
                <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80" class="rounded-2xl shadow-md w-full h-48 object-cover" />
                <img src="https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=400&q=80" class="rounded-2xl shadow-md w-full h-48 object-cover mt-8" />
              </div>
            </div>
          </section>
        `
      }
    ]
  }
];

async function main() {
  console.log('Seeding Genre Products...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "GenreProduct";');
  
  for (const product of genreProducts) {
    console.log('Inserting product:', product.name);
    
    await prisma.genreProduct.create({
      data: {
        genre: product.genre,
        name: product.name,
        description: product.description,
        thumbnail: product.thumbnail,
        icon: product.icon,
        defaultTheme: product.defaultTheme,
        sections: product.sections
      }
    });
  }
  
  console.log('✅ Genre Products seeded successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

import { GoogleGenAI } from '@google/genai';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const prisma = new PrismaClient();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const templates = [
  // ─── 0. HEADER TEMPLATES ────────────────────────────────────────────
  {
    name: 'Luxury Glassmorphism Sticky Header',
    category: 'Header',
    htmlContent: `
      <header class="sticky top-0 z-50 backdrop-blur-2xl bg-[#07090e]/80 border-b border-white/[0.08] transition-all">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-400 to-teal-400 flex items-center justify-center font-black text-black text-xl shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              {{TITLE_FIRST_LETTER}}
            </div>
            <div>
              <div class="font-black text-xl tracking-tight text-white">{{TITLE}}</div>
              <div class="text-[10px] text-emerald-400 font-bold tracking-wider uppercase flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> Live
              </div>
            </div>
          </div>
          <nav class="hidden md:flex items-center gap-8 text-sm font-medium text-gray-300">
            <a href="#products" class="hover:text-white transition-colors">Catalog</a>
            <a href="#features" class="hover:text-white transition-colors">Benefits</a>
            <a href="#contact" class="hover:text-white transition-colors">Contact</a>
          </nav>
          <div class="flex items-center gap-4">
            <button onclick="toggleCart && toggleCart()" class="relative flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-white text-sm font-semibold transition-all">
              <span>🛒 Cart</span>
              <span id="cart-count" class="w-5 h-5 rounded-full bg-emerald-500 text-black text-xs font-extrabold flex items-center justify-center">0</span>
            </button>
          </div>
        </div>
      </header>
    `
  },
  // ─── 1. HERO TEMPLATES ──────────────────────────────────────────────
  {
    name: 'Ultra-Luxury Dark Glassmorphism Hero',
    category: 'Hero',
    htmlContent: `
      <section class="relative min-h-[85vh] flex items-center justify-center bg-[#07090e] text-white px-4 sm:px-6 lg:px-8 py-24 overflow-hidden">
        <!-- Ambient Glowing Gradient Orbs -->
        <div class="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-emerald-500/20 via-teal-500/10 to-indigo-500/20 blur-[130px] rounded-full pointer-events-none"></div>
        <div class="absolute -bottom-24 -left-24 w-[400px] h-[400px] bg-emerald-600/10 blur-[100px] rounded-full pointer-events-none"></div>
        
        <!-- Subtle Grid Pattern Background -->
        <div class="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none"></div>

        <div class="relative z-10 max-w-5xl mx-auto text-center">
          <!-- Floating Badge -->
          <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-xl bg-white/[0.05] border border-white/[0.1] shadow-2xl mb-8 animate-pulse">
            <span class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_#10b981]"></span>
            <span class="text-xs font-semibold uppercase tracking-widest text-emerald-300">✨ Verified Quality & Fast Delivery</span>
          </div>

          <!-- Main Headline -->
          <h1 class="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-8 text-white">
            Elevate Your Experience with <br class="hidden sm:inline"/>
            <span class="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 drop-shadow-sm">{{TITLE}}</span>
          </h1>

          <!-- Subtitle -->
          <p class="text-lg sm:text-xl text-gray-400 mb-12 max-w-2xl mx-auto font-normal leading-relaxed">
            {{SUBTITLE}}
          </p>

          <!-- Action Buttons -->
          <div class="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            <a href="#products" class="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-black bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 shadow-[0_0_30px_rgba(16,185,129,0.35)] hover:shadow-[0_0_45px_rgba(16,185,129,0.5)] transform hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2">
              <span>{{CTA_PRIMARY}}</span>
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
            </a>
            <a href="#contact" class="w-full sm:w-auto px-8 py-4 rounded-xl font-semibold text-white backdrop-blur-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.15] hover:border-white/[0.3] transition-all duration-300 flex items-center justify-center gap-2">
              <span>{{CTA_SECONDARY}}</span>
            </a>
          </div>

          <!-- Trust Proof -->
          <div class="mt-16 pt-10 border-t border-white/[0.08] grid grid-cols-2 md:grid-cols-4 gap-6 text-left">
            <div class="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div class="text-2xl font-black text-white">4.9 ★★★★★</div>
              <div class="text-xs text-gray-400 mt-1">Customer Satisfaction</div>
            </div>
            <div class="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div class="text-2xl font-black text-white">100%</div>
              <div class="text-xs text-gray-400 mt-1">Genuine & Authentic</div>
            </div>
            <div class="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div class="text-2xl font-black text-white">Instant</div>
              <div class="text-xs text-gray-400 mt-1">WhatsApp Support</div>
            </div>
            <div class="p-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <div class="text-2xl font-black text-white">Secure</div>
              <div class="text-xs text-gray-400 mt-1">UPI & Card Payment</div>
            </div>
          </div>
        </div>
      </section>
    `
  },
  {
    name: 'Modern SaaS Bento Grid Hero',
    category: 'Hero',
    htmlContent: `
      <section class="relative bg-slate-950 text-white py-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div class="max-w-7xl mx-auto">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <!-- Left Column: Copy -->
            <div class="lg:col-span-7 text-left">
              <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mb-6">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                Next-Gen Commerce Experience
              </div>
              <h1 class="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight mb-6">
                {{TITLE}}
              </h1>
              <p class="text-lg text-slate-300 mb-8 max-w-xl leading-relaxed">
                {{SUBTITLE}}
              </p>
              <div class="flex flex-wrap gap-4">
                <a href="#products" class="px-7 py-3.5 rounded-xl font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 shadow-[0_0_25px_rgba(52,211,153,0.4)] transition-all">
                  {{CTA_PRIMARY}}
                </a>
                <a href="#features" class="px-7 py-3.5 rounded-xl font-semibold text-white border border-slate-700 hover:bg-slate-800 transition-colors">
                  {{CTA_SECONDARY}}
                </a>
              </div>
            </div>

            <!-- Right Column: Interactive Card Preview -->
            <div class="lg:col-span-5 relative">
              <div class="p-6 rounded-3xl bg-gradient-to-b from-slate-800/80 to-slate-900/90 border border-slate-700 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                <div class="flex items-center justify-between border-b border-slate-700/80 pb-4 mb-6">
                  <div class="flex items-center gap-2">
                    <div class="w-3 h-3 rounded-full bg-rose-500"></div>
                    <div class="w-3 h-3 rounded-full bg-amber-500"></div>
                    <div class="w-3 h-3 rounded-full bg-emerald-500"></div>
                  </div>
                  <span class="text-xs font-mono text-slate-400">Live Storefront</span>
                </div>
                <div class="space-y-4">
                  <div class="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">⚡</div>
                      <div>
                        <div class="text-sm font-semibold text-white">Direct WhatsApp Ordering</div>
                        <div class="text-xs text-slate-400">Instant customer checkout</div>
                      </div>
                    </div>
                    <span class="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">Active</span>
                  </div>
                  <div class="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">💳</div>
                      <div>
                        <div class="text-sm font-semibold text-white">Instant UPI Payments</div>
                        <div class="text-xs text-slate-400">0% transaction delays</div>
                      </div>
                    </div>
                    <span class="text-xs px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-400 font-bold">Fast</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `
  },

  // ─── 2. FEATURE BENTO GRID ──────────────────────────────────────────
  {
    name: 'Luxury Bento Grid Features',
    category: 'FeatureGrid',
    htmlContent: `
      <section id="features" class="py-24 bg-[#090c14] text-white px-4 sm:px-6 lg:px-8 border-t border-white/[0.05]">
        <div class="max-w-7xl mx-auto">
          <!-- Section Header -->
          <div class="text-center max-w-3xl mx-auto mb-16">
            <span class="text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full">Core Advantages</span>
            <h2 class="text-3xl sm:text-5xl font-extrabold text-white mt-4 mb-4 tracking-tight">{{SECTION_TITLE}}</h2>
            <p class="text-gray-400 text-base sm:text-lg">Designed for maximum quality, speed, and customer satisfaction.</p>
          </div>

          <!-- Bento Grid Layout -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Bento Card 1 (Large) -->
            <div class="md:col-span-2 p-8 rounded-3xl bg-gradient-to-br from-white/[0.05] to-white/[0.01] border border-white/[0.08] hover:border-emerald-500/40 transition-all duration-300 group hover:shadow-[0_0_30px_rgba(16,185,129,0.1)]">
              <div class="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-6 text-2xl group-hover:scale-110 transition-transform">
                💎
              </div>
              <h3 class="text-2xl font-bold text-white mb-3">{{FEATURE_TITLE}}</h3>
              <p class="text-gray-400 leading-relaxed max-w-xl">{{FEATURE_DESC}}</p>
              <div class="mt-8 flex items-center gap-4 text-xs font-semibold text-emerald-400">
                <span>Highest Grade Quality</span> • <span>Quality Check Verified</span>
              </div>
            </div>

            <!-- Bento Card 2 -->
            <div class="p-8 rounded-3xl bg-gradient-to-br from-white/[0.05] to-white/[0.01] border border-white/[0.08] hover:border-teal-500/40 transition-all duration-300 group hover:shadow-[0_0_30px_rgba(20,184,166,0.1)]">
              <div class="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/30 text-teal-400 flex items-center justify-center mb-6 text-2xl group-hover:scale-110 transition-transform">
                ⚡
              </div>
              <h3 class="text-xl font-bold text-white mb-3">Instant Doorstep Delivery</h3>
              <p class="text-gray-400 text-sm leading-relaxed">Lightning-fast fulfillment with real-time tracking directly to your location.</p>
            </div>

            <!-- Bento Card 3 -->
            <div class="p-8 rounded-3xl bg-gradient-to-br from-white/[0.05] to-white/[0.01] border border-white/[0.08] hover:border-indigo-500/40 transition-all duration-300 group hover:shadow-[0_0_30px_rgba(99,102,241,0.1)]">
              <div class="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-6 text-2xl group-hover:scale-110 transition-transform">
                🛡️
              </div>
              <h3 class="text-xl font-bold text-white mb-3">100% Secure Checkout</h3>
              <p class="text-gray-400 text-sm leading-relaxed">End-to-end encrypted transactions via UPI, Cards, and Verified Net Banking.</p>
            </div>

            <!-- Bento Card 4 (Large) -->
            <div class="md:col-span-2 p-8 rounded-3xl bg-gradient-to-br from-white/[0.05] to-white/[0.01] border border-white/[0.08] hover:border-cyan-500/40 transition-all duration-300 group hover:shadow-[0_0_30px_rgba(6,182,212,0.1)]">
              <div class="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mb-6 text-2xl group-hover:scale-110 transition-transform">
                💬
              </div>
              <h3 class="text-2xl font-bold text-white mb-3">24/7 Dedicated Support</h3>
              <p class="text-gray-400 leading-relaxed max-w-xl">Have a question or custom request? Chat directly with our business team on WhatsApp for instant assistance.</p>
            </div>
          </div>
        </div>
      </section>
    `
  },

  // ─── 3. PRODUCT SHOWCASE ──────────────────────────────────────────
  {
    name: 'Luxury Product & Catalog Showcase',
    category: 'Products',
    htmlContent: `
      <section id="products" class="py-24 bg-[#07090e] text-white px-4 sm:px-6 lg:px-8 border-t border-white/[0.05]">
        <div class="max-w-7xl mx-auto">
          <div class="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div>
              <span class="text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full">Curated Collection</span>
              <h2 class="text-3xl sm:text-5xl font-extrabold text-white mt-4 tracking-tight">Our Premium Offerings</h2>
            </div>
            <p class="text-gray-400 text-sm max-w-md">Browse through our top-rated collection crafted with precision and care.</p>
          </div>

          <!-- Product Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <!-- Sample Card 1 -->
            <div class="group relative rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-emerald-500/40 p-5 transition-all duration-300 hover:shadow-[0_0_25px_rgba(16,185,129,0.15)] flex flex-col justify-between">
              <div>
                <div class="relative aspect-square rounded-xl bg-gradient-to-br from-emerald-500/10 via-slate-800 to-slate-900 flex items-center justify-center text-5xl mb-4 overflow-hidden group-hover:scale-[1.02] transition-transform">
                  <span class="transform group-hover:scale-110 transition-transform">✨</span>
                  <span class="absolute top-2 right-2 bg-emerald-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full">HOT</span>
                </div>
                <div class="text-xs text-emerald-400 font-semibold mb-1">Top Rated</div>
                <h3 class="font-bold text-lg text-white group-hover:text-emerald-300 transition-colors">Signature Experience</h3>
                <p class="text-gray-400 text-xs mt-1 line-clamp-2">Premium crafted quality with guaranteed satisfaction.</p>
              </div>
              <div class="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                <div>
                  <span class="text-xs text-gray-400 line-through">₹1,499</span>
                  <div class="text-xl font-extrabold text-emerald-400">₹999</div>
                </div>
                <button class="px-4 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all">
                  Add +
                </button>
              </div>
            </div>

            <!-- Sample Card 2 -->
            <div class="group relative rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-teal-500/40 p-5 transition-all duration-300 hover:shadow-[0_0_25px_rgba(20,184,166,0.15)] flex flex-col justify-between">
              <div>
                <div class="relative aspect-square rounded-xl bg-gradient-to-br from-teal-500/10 via-slate-800 to-slate-900 flex items-center justify-center text-5xl mb-4 overflow-hidden group-hover:scale-[1.02] transition-transform">
                  <span class="transform group-hover:scale-110 transition-transform">💎</span>
                </div>
                <div class="text-xs text-teal-400 font-semibold mb-1">Exclusive</div>
                <h3 class="font-bold text-lg text-white group-hover:text-teal-300 transition-colors">Deluxe Package</h3>
                <p class="text-gray-400 text-xs mt-1 line-clamp-2">Complete end-to-end luxury experience with complimentary perks.</p>
              </div>
              <div class="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                <div>
                  <span class="text-xs text-gray-400 line-through">₹2,499</span>
                  <div class="text-xl font-extrabold text-teal-400">₹1,799</div>
                </div>
                <button class="px-4 py-2 rounded-lg bg-teal-400 hover:bg-teal-300 text-black font-bold text-xs shadow-[0_0_15px_rgba(20,184,166,0.3)] transition-all">
                  Add +
                </button>
              </div>
            </div>

            <!-- Sample Card 3 -->
            <div class="group relative rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-indigo-500/40 p-5 transition-all duration-300 hover:shadow-[0_0_25px_rgba(99,102,241,0.15)] flex flex-col justify-between">
              <div>
                <div class="relative aspect-square rounded-xl bg-gradient-to-br from-indigo-500/10 via-slate-800 to-slate-900 flex items-center justify-center text-5xl mb-4 overflow-hidden group-hover:scale-[1.02] transition-transform">
                  <span class="transform group-hover:scale-110 transition-transform">⚡</span>
                  <span class="absolute top-2 right-2 bg-indigo-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">POPULAR</span>
                </div>
                <div class="text-xs text-indigo-400 font-semibold mb-1">Trending</div>
                <h3 class="font-bold text-lg text-white group-hover:text-indigo-300 transition-colors">Fast Track Bundle</h3>
                <p class="text-gray-400 text-xs mt-1 line-clamp-2">Priority expedited service tailored for busy individuals.</p>
              </div>
              <div class="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                <div>
                  <span class="text-xs text-gray-400 line-through">₹999</span>
                  <div class="text-xl font-extrabold text-indigo-400">₹649</div>
                </div>
                <button class="px-4 py-2 rounded-lg bg-indigo-400 hover:bg-indigo-300 text-black font-bold text-xs shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all">
                  Add +
                </button>
              </div>
            </div>

            <!-- Sample Card 4 -->
            <div class="group relative rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-cyan-500/40 p-5 transition-all duration-300 hover:shadow-[0_0_25px_rgba(6,182,212,0.15)] flex flex-col justify-between">
              <div>
                <div class="relative aspect-square rounded-xl bg-gradient-to-br from-cyan-500/10 via-slate-800 to-slate-900 flex items-center justify-center text-5xl mb-4 overflow-hidden group-hover:scale-[1.02] transition-transform">
                  <span class="transform group-hover:scale-110 transition-transform">🌟</span>
                </div>
                <div class="text-xs text-cyan-400 font-semibold mb-1">Seasonal</div>
                <h3 class="font-bold text-lg text-white group-hover:text-cyan-300 transition-colors">Custom Edition</h3>
                <p class="text-gray-400 text-xs mt-1 line-clamp-2">Bespoke personalized solution tailored exactly to your preferences.</p>
              </div>
              <div class="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-between">
                <div>
                  <span class="text-xs text-gray-400 line-through">₹3,999</span>
                  <div class="text-xl font-extrabold text-cyan-400">₹2,999</div>
                </div>
                <button class="px-4 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black font-bold text-xs shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all">
                  Add +
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    `
  },

  // ─── 4. TESTIMONIALS & SOCIAL PROOF ─────────────────────────────────
  {
    name: 'Social Proof & Verified Reviews',
    category: 'Testimonials',
    htmlContent: `
      <section class="py-24 bg-[#090c14] text-white px-4 sm:px-6 lg:px-8 border-t border-white/[0.05]">
        <div class="max-w-7xl mx-auto">
          <div class="text-center max-w-2xl mx-auto mb-16">
            <span class="text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full">Customer Love</span>
            <h2 class="text-3xl sm:text-5xl font-extrabold text-white mt-4 mb-4 tracking-tight">Trusted by 10,000+ Happy Clients</h2>
            <p class="text-gray-400">Real feedback from verified customers across the country.</p>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <!-- Review 1 -->
            <div class="p-8 rounded-3xl bg-white/[0.03] border border-white/[0.08] flex flex-col justify-between hover:border-emerald-500/30 transition-all">
              <div>
                <div class="flex text-amber-400 text-lg mb-4">★★★★★</div>
                <p class="text-gray-300 leading-relaxed text-sm">"The service quality was beyond my expectations! The speed of delivery and the personal WhatsApp support made this the smoothest experience ever."</p>
              </div>
              <div class="mt-8 flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                <div class="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">RS</div>
                <div>
                  <div class="font-bold text-sm text-white">Rahul Sharma</div>
                  <div class="text-xs text-gray-400">Verified Buyer • Mumbai</div>
                </div>
              </div>
            </div>

            <!-- Review 2 -->
            <div class="p-8 rounded-3xl bg-white/[0.03] border border-white/[0.08] flex flex-col justify-between hover:border-teal-500/30 transition-all">
              <div>
                <div class="flex text-amber-400 text-lg mb-4">★★★★★</div>
                <p class="text-gray-300 leading-relaxed text-sm">"Incredible attention to detail. I recommended this business to all my colleagues and friends. Keep up the high standard!"</p>
              </div>
              <div class="mt-8 flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                <div class="w-10 h-10 rounded-full bg-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm">PP</div>
                <div>
                  <div class="font-bold text-sm text-white">Priya Patel</div>
                  <div class="text-xs text-gray-400">Verified Client • Bengaluru</div>
                </div>
              </div>
            </div>

            <!-- Review 3 -->
            <div class="p-8 rounded-3xl bg-white/[0.03] border border-white/[0.08] flex flex-col justify-between hover:border-indigo-500/30 transition-all">
              <div>
                <div class="flex text-amber-400 text-lg mb-4">★★★★★</div>
                <p class="text-gray-300 leading-relaxed text-sm">"Flawless checkout with UPI and received my updates immediately. 10/10 for reliability and customer care."</p>
              </div>
              <div class="mt-8 flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                <div class="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-sm">AK</div>
                <div>
                  <div class="font-bold text-sm text-white">Amit Kumar</div>
                  <div class="text-xs text-gray-400">Verified Customer • Delhi</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `
  },

  // ─── 5. CONTACT & INTERACTIVE FORM ──────────────────────────────────
  {
    name: 'Glassmorphism Interactive Contact Section',
    category: 'ContactForm',
    htmlContent: `
      <section id="contact" class="py-24 bg-[#07090e] text-white px-4 sm:px-6 lg:px-8 border-t border-white/[0.05] relative overflow-hidden">
        <div class="absolute bottom-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 blur-[140px] rounded-full pointer-events-none"></div>

        <div class="max-w-5xl mx-auto relative z-10">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <!-- Left Info -->
            <div class="lg:col-span-5 text-left">
              <span class="text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full">Get In Touch</span>
              <h2 class="text-3xl sm:text-5xl font-extrabold text-white mt-4 mb-6 tracking-tight">{{TITLE}}</h2>
              <p class="text-gray-400 text-sm leading-relaxed mb-8">We are always ready to assist you. Send us a message or connect directly on WhatsApp for an immediate response.</p>
              
              <div class="space-y-4">
                <div class="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <div class="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">📧</div>
                  <div>
                    <div class="text-xs text-gray-400">Email Address</div>
                    <div class="text-sm font-semibold text-white">{{EMAIL}}</div>
                  </div>
                </div>
                <div class="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <div class="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center text-lg">💬</div>
                  <div>
                    <div class="text-xs text-gray-400">WhatsApp Concierge</div>
                    <div class="text-sm font-semibold text-white">Instant Response (Online)</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Form -->
            <div class="lg:col-span-7">
              <div class="p-8 sm:p-10 rounded-3xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] border border-white/[0.1] backdrop-blur-2xl shadow-2xl">
                <form class="space-y-5" onsubmit="event.preventDefault(); alert('Message sent successfully!');">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">Your Name</label>
                      <input type="text" required class="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] focus:border-emerald-400 focus:bg-white/[0.08] text-white placeholder-gray-500 outline-none text-sm transition-all" placeholder="John Doe">
                    </div>
                    <div>
                      <label class="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">Phone / WhatsApp</label>
                      <input type="tel" required class="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] focus:border-emerald-400 focus:bg-white/[0.08] text-white placeholder-gray-500 outline-none text-sm transition-all" placeholder="+91 98765 43210">
                    </div>
                  </div>
                  <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">Your Email</label>
                    <input type="email" required class="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] focus:border-emerald-400 focus:bg-white/[0.08] text-white placeholder-gray-500 outline-none text-sm transition-all" placeholder="name@example.com">
                  </div>
                  <div>
                    <label class="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">How Can We Help?</label>
                    <textarea rows="4" required class="w-full px-4 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] focus:border-emerald-400 focus:bg-white/[0.08] text-white placeholder-gray-500 outline-none text-sm transition-all" placeholder="Tell us about your requirements..."></textarea>
                  </div>
                  <button type="submit" class="w-full py-4 rounded-xl font-bold text-black bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all">
                    Send Inquiry Now →
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    `
  },
  // ─── 6. FOOTER TEMPLATES ────────────────────────────────────────────
  {
    name: 'Modern Luxury Footer',
    category: 'Footer',
    htmlContent: `
      <footer class="bg-[#040609] text-white border-t border-white/[0.08] py-16 px-4 sm:px-6 lg:px-8">
        <div class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div class="md:col-span-2">
            <div class="font-extrabold text-2xl tracking-tight text-white mb-4">{{TITLE}}</div>
            <p class="text-gray-400 text-sm max-w-sm mb-6 leading-relaxed">{{SUBTITLE}}</p>
            <div class="flex items-center gap-3 text-xs text-emerald-400 font-semibold">
              <span>🔒 256-Bit SSL Encrypted</span> • <span>⚡ Instant UPI Checkout</span>
            </div>
          </div>
          <div>
            <h4 class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Quick Links</h4>
            <ul class="space-y-2.5 text-sm text-gray-400">
              <li><a href="#products" class="hover:text-emerald-400 transition-colors">Products & Services</a></li>
              <li><a href="#features" class="hover:text-emerald-400 transition-colors">Our Advantage</a></li>
              <li><a href="#contact" class="hover:text-emerald-400 transition-colors">Support & Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 class="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Accepted Payments</h4>
            <div class="flex flex-wrap gap-2 text-xs font-semibold text-gray-300">
              <span class="px-2.5 py-1 rounded bg-white/[0.05] border border-white/[0.08]">UPI</span>
              <span class="px-2.5 py-1 rounded bg-white/[0.05] border border-white/[0.08]">Cards</span>
              <span class="px-2.5 py-1 rounded bg-white/[0.05] border border-white/[0.08]">Net Banking</span>
              <span class="px-2.5 py-1 rounded bg-white/[0.05] border border-white/[0.08]">COD</span>
            </div>
          </div>
        </div>
        <div class="max-w-7xl mx-auto pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between text-xs text-gray-500 gap-4">
          <p>© 2026 {{TITLE}}. All rights reserved.</p>
          <p class="text-gray-400">Powered by <span class="text-emerald-400 font-semibold">BusinessOS AI Platform</span></p>
        </div>
      </footer>
    `
  }
];

async function main() {
  console.log('Seeding rich modern component templates...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "ComponentTemplate";');

  for (const template of templates) {
    console.log('Generating embedding for ' + template.name + '...');
    const embeddingText = 'Category: ' + template.category + '. Name: ' + template.name + '. Code: ' + template.htmlContent;
    
    let embedding: number[];
    try {
      const response = await ai.models.embedContent({
        model: 'text-embedding-004',
        contents: embeddingText,
      });
      embedding = response.embeddings?.[0]?.values || Array.from({ length: 768 }, () => Math.random() - 0.5);
    } catch (err: any) {
      console.warn('⚠️  Warning: Failed to generate real embedding. Using a dummy embedding instead. Error:', err.message);
      embedding = Array.from({ length: 768 }, () => Math.random() - 0.5);
    }

    const id = uuidv4();
    console.log('Inserting ' + template.name + ' into database...');
    const formattedEmbedding = '[' + embedding.join(',') + ']';
    
    await prisma.$executeRawUnsafe(
      'INSERT INTO "ComponentTemplate" (id, name, category, "htmlContent", "createdAt", "updatedAt", embedding) VALUES ($1, $2, $3, $4, now(), now(), $5::vector)',
      id,
      template.name,
      template.category,
      template.htmlContent,
      formattedEmbedding
    );
  }
  
  console.log('✅ Rich templates seeded successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

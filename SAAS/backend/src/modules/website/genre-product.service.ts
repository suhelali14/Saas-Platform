import prisma from '../../lib/prisma';
import { NotFoundError, BadRequestError } from '../../lib/errors';

// ─── Genre Product CRUD ─────────────────────────────────────────────────────

/**
 * Get all available genre products for the catalog
 */
export async function getAllGenreProducts() {
  return prisma.genreProduct.findMany({
    where: { isActive: true },
    orderBy: { usageCount: 'desc' },
  });
}

/**
 * Get a specific genre product by genre type
 */
export async function getGenreProduct(genre: string) {
  // Try exact match first, then try mapped genres
  let product = await prisma.genreProduct.findUnique({
    where: { genre },
  });

  if (!product) {
    // Try mapped genres (e.g. SPA maps to SALON product)
    const genreMapping: Record<string, string> = {
      SPA: 'SALON',
      CAFE: 'RESTAURANT',
      BAKERY: 'RESTAURANT',
      HOSPITAL: 'CLINIC',
      PHARMACY: 'CLINIC',
      BOUTIQUE: 'D2C_BRAND',
      KIRANA_STORE: 'RETAIL_STORE',
      GROCERY: 'RETAIL_STORE',
      ELECTRONICS: 'RETAIL_STORE',
    };

    const mappedGenre = genreMapping[genre];
    if (mappedGenre) {
      product = await prisma.genreProduct.findUnique({
        where: { genre: mappedGenre },
      });
    }
  }

  return product;
}

/**
 * Apply a genre product to a business — merges user customizations with the product defaults
 */
export async function applyGenreProduct(
  businessId: string,
  genreProductId: string,
  customizations?: {
    primaryColor?: string;
    font?: string;
    disabledSections?: string[];
    sectionOverrides?: Record<string, any>;
  }
) {
  const product = await prisma.genreProduct.findUnique({
    where: { id: genreProductId },
  });
  if (!product) throw new NotFoundError('Genre Product');

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) throw new NotFoundError('Business');

  // Build theme (merge defaults with user overrides)
  const defaultTheme = product.defaultTheme as any;
  const theme = {
    primaryColor: customizations?.primaryColor || defaultTheme.primaryColor || '#10b981',
    font: customizations?.font || defaultTheme.font || 'Plus Jakarta Sans',
    mode: defaultTheme.mode || 'dark',
  };

  // Build blocks from sections (apply user overrides)
  const sections = product.sections as any[];
  const disabledSet = new Set(customizations?.disabledSections || []);
  const overrides = customizations?.sectionOverrides || {};

  const blocks = sections
    .filter((s: any) => !disabledSet.has(s.id))
    .map((section: any, idx: number) => {
      const sectionOverride = overrides[section.id] || {};

      // Replace business-specific placeholders in HTML
      let html = section.htmlContent || '';
      html = html
        .replace(/\{\{BUSINESS_NAME\}\}/g, business.name)
        .replace(/\{\{TITLE\}\}/g, business.name)
        .replace(/\{\{SUBTITLE\}\}/g, business.description || 'Premium quality, exceptional service.')
        .replace(/\{\{PHONE\}\}/g, business.phone || '+91 98765 43210')
        .replace(/\{\{EMAIL\}\}/g, business.email || 'hello@' + (business.slug || 'business') + '.com')
        .replace(/\{\{PRIMARY_COLOR\}\}/g, theme.primaryColor)
        .replace(/\{\{CTA_PRIMARY\}\}/g, sectionOverride.ctaPrimary || section.defaultCta || 'Get Started')
        .replace(/\{\{CTA_SECONDARY\}\}/g, sectionOverride.ctaSecondary || section.defaultCtaSecondary || 'Learn More');

      return {
        id: section.id || 'block-' + Date.now() + '-' + idx,
        type: 'RawHtml',
        order: idx + 1,
        props: {
          html,
          originalCategory: section.category,
          sectionName: section.name,
          editable: true,
          ...sectionOverride,
        },
      };
    });

  // Save to WebsiteConfig
  await prisma.websiteConfig.upsert({
    where: { businessId },
    update: {
      theme,
      blocks,
      template: 'genre-' + product.genre.toLowerCase(),
    },
    create: {
      businessId,
      theme,
      blocks,
      template: 'genre-' + product.genre.toLowerCase(),
    },
  });

  // Increment usage count
  await prisma.genreProduct.update({
    where: { id: genreProductId },
    data: { usageCount: { increment: 1 } },
  });

  return { theme, blocks, product };
}

// ─── Genre Product Requests ─────────────────────────────────────────────────

/**
 * Submit a request for a genre that doesn't have a product yet
 */
export async function submitGenreRequest(
  businessId: string,
  data: {
    genre: string;
    requirements: string;
    referenceUrls?: string;
    contactPhone?: string;
    contactEmail?: string;
  }
) {
  if (!data.requirements || data.requirements.trim().length < 10) {
    throw new BadRequestError('Please describe your requirements in at least 10 characters.');
  }

  return prisma.genreProductRequest.create({
    data: {
      businessId,
      genre: data.genre,
      requirements: data.requirements,
      referenceUrls: data.referenceUrls,
      contactPhone: data.contactPhone,
      contactEmail: data.contactEmail,
      status: 'PENDING',
    },
  });
}

/**
 * Get all genre product requests (admin)
 */
export async function getGenreRequests(status?: string) {
  return prisma.genreProductRequest.findMany({
    where: status ? { status } : undefined,
    include: {
      business: {
        select: { id: true, name: true, type: true, email: true, phone: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update a genre product request (admin)
 */
export async function updateGenreRequest(
  id: string,
  data: { status?: string; adminNotes?: string }
) {
  return prisma.genreProductRequest.update({
    where: { id },
    data: {
      ...(data.status && { status: data.status }),
      ...(data.adminNotes !== undefined && { adminNotes: data.adminNotes }),
    },
  });
}

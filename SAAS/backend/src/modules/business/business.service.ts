import prisma from '../../lib/prisma';
import { NotFoundError } from '../../lib/errors';
import { BusinessType } from '@prisma/client';

export async function getBusinessById(businessId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      channels: true,
      websiteConfig: true,
      _count: {
        select: {
          customers: true,
          products: true,
          services: true,
          orders: true,
          employees: true,
          conversations: true,
        },
      },
    },
  });

  if (!business) {
    throw new NotFoundError('Business');
  }

  return business;
}

export async function updateBusiness(businessId: string, data: any) {
  const business = await prisma.business.update({
    where: { id: businessId },
    data: {
      name: data.name,
      description: data.description,
      logo: data.logo,
      phone: data.phone,
      email: data.email,
      address: data.address,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      type: data.type as BusinessType,
      aiProvider: data.aiProvider,
      aiApiKey: data.aiApiKey,
    },
  });

  return business;
}

export async function updateDNA(businessId: string, dna: any) {
  const business = await prisma.business.update({
    where: { id: businessId },
    data: {
      languages: dna.languages,
      currency: dna.currency,
      timezone: dna.timezone,
      workingHours: dna.workingHours,
      deliveryRules: dna.deliveryRules,
      paymentMethods: dna.paymentMethods,
      pricingRules: dna.pricingRules,
      policies: dna.policies,
    },
  });

  return business;
}

export async function markOnboardingComplete(businessId: string) {
  const business = await prisma.business.update({
    where: { id: businessId },
    data: { onboardingCompleted: true },
  });

  return business;
}

/**
 * Get the default modules/features for a business type
 */
export function getBusinessTypeConfig(type: BusinessType) {
  const configs: Record<string, any> = {
    KIRANA_STORE: {
      modules: ['catalog', 'orders', 'inventory', 'customers', 'conversations', 'payments', 'delivery', 'analytics'],
      features: ['whatsapp_ordering', 'repeat_orders', 'delivery', 'credit_tracking'],
      primaryFlow: 'product → order → payment → delivery',
    },
    RETAIL_STORE: {
      modules: ['catalog', 'orders', 'inventory', 'customers', 'conversations', 'payments', 'analytics'],
      features: ['whatsapp_ordering', 'website', 'pos', 'loyalty'],
      primaryFlow: 'product → order → payment → pickup/delivery',
    },
    RESTAURANT: {
      modules: ['catalog', 'orders', 'customers', 'conversations', 'payments', 'employees', 'analytics'],
      features: ['menu', 'table_booking', 'kitchen_display', 'delivery', 'loyalty'],
      primaryFlow: 'menu → order → kitchen → serve/deliver → payment',
    },
    SALON: {
      modules: ['services', 'appointments', 'customers', 'employees', 'conversations', 'payments', 'analytics'],
      features: ['booking', 'reminders', 'stylist_assignment', 'memberships'],
      primaryFlow: 'service → appointment → employee → service → payment',
    },
    CLINIC: {
      modules: ['services', 'appointments', 'customers', 'employees', 'conversations', 'payments', 'analytics'],
      features: ['booking', 'reminders', 'patient_records', 'follow_ups'],
      primaryFlow: 'appointment → consultation → prescription → follow-up',
    },
    REAL_ESTATE: {
      modules: ['catalog', 'customers', 'conversations', 'employees', 'analytics'],
      features: ['leads', 'property_catalog', 'site_visits', 'lead_qualification'],
      primaryFlow: 'lead → qualification → viewing → negotiation → deal',
    },
    TRAVEL_AGENCY: {
      modules: ['services', 'customers', 'conversations', 'payments', 'analytics'],
      features: ['inquiry', 'itinerary', 'quotation', 'booking'],
      primaryFlow: 'inquiry → itinerary → quotation → booking → payment',
    },
    D2C_BRAND: {
      modules: ['catalog', 'orders', 'inventory', 'customers', 'conversations', 'payments', 'analytics', 'marketing'],
      features: ['website', 'social_commerce', 'loyalty', 'reviews', 'shipping'],
      primaryFlow: 'discover → product → order → ship → review',
    },
  };

  return configs[type] || configs['RETAIL_STORE'];
}

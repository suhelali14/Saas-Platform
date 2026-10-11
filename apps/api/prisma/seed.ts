import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Matches the placeholder in apps/mobile/src/screens/HomeScreen.tsx until
// docs/14-mvp-implementation-plan.md M5 (real auth) lands. IntentRequest and
// UserProfile both have a foreign key to User -- without this row, the very
// first request from the app fails on a FK violation the moment a real
// database is connected.
const DEV_USER_ID = "dev-user-1";

interface SeedBusiness {
  name: string;
  categories: string[];
  city: string;
  address: string;
  ratingAverage: number;
  offers: Array<{ price: number; description: string }>;
}

// Placeholder dev fixtures, not real businesses. City/categories follow the
// default in docs/11-glossary-open-questions.md -- confirm before treating
// this as anything more than local seed data.
const BUSINESSES: SeedBusiness[] = [
  { name: "Copper Leaf Kitchen", categories: ["restaurant"], city: "Bengaluru", address: "Koramangala 5th Block", ratingAverage: 4.4, offers: [{ price: 1399, description: "Rooftop dinner for two, 10% new-customer discount" }] },
  { name: "Spice Route Diner", categories: ["restaurant"], city: "Bengaluru", address: "Indiranagar 100 Ft Road", ratingAverage: 4.1, offers: [{ price: 899, description: "North Indian thali for two" }] },
  { name: "Green Bowl Cafe", categories: ["restaurant"], city: "Bengaluru", address: "HSR Layout", ratingAverage: 4.6, offers: [{ price: 650, description: "Healthy bowls, under 500 cal" }] },
  { name: "Urban Tandoor", categories: ["restaurant"], city: "Bengaluru", address: "Whitefield", ratingAverage: 4.0, offers: [{ price: 1799, description: "Live music, rooftop seating" }] },
  { name: "Sunset Terrace Grill", categories: ["restaurant"], city: "Bengaluru", address: "MG Road", ratingAverage: 4.3, offers: [{ price: 2100, description: "Rooftop grill, weekend brunch" }] },
  { name: "IronCore Fitness", categories: ["gym"], city: "Bengaluru", address: "Koramangala 4th Block", ratingAverage: 4.2, offers: [{ price: 1799, description: "Monthly membership, free trial day" }] },
  { name: "PowerHouse Gym", categories: ["gym"], city: "Bengaluru", address: "Indiranagar", ratingAverage: 4.0, offers: [{ price: 1500, description: "Monthly membership, group classes included" }] },
  { name: "FlexFit Studio", categories: ["gym"], city: "Bengaluru", address: "HSR Layout", ratingAverage: 4.5, offers: [{ price: 2200, description: "Monthly membership, personal trainer session included" }] },
  { name: "CoreStrength Gym", categories: ["gym"], city: "Bengaluru", address: "Whitefield", ratingAverage: 3.9, offers: [{ price: 1200, description: "Budget membership, no frills" }] },
  { name: "Elevate Gym & Yoga", categories: ["gym"], city: "Bengaluru", address: "Jayanagar", ratingAverage: 4.4, offers: [{ price: 1999, description: "Monthly membership + yoga classes" }] },
  { name: "Urban Cuts Salon", categories: ["salon"], city: "Bengaluru", address: "Koramangala 6th Block", ratingAverage: 4.3, offers: [{ price: 699, description: "Haircut + beard grooming" }] },
  { name: "Glow Beauty Studio", categories: ["salon"], city: "Bengaluru", address: "Indiranagar", ratingAverage: 4.6, offers: [{ price: 1200, description: "Spa + facial package" }] },
  { name: "Classic Trims", categories: ["salon"], city: "Bengaluru", address: "HSR Layout", ratingAverage: 3.8, offers: [{ price: 350, description: "Quick haircut, no appointment needed" }] },
  { name: "Radiance Salon", categories: ["salon"], city: "Bengaluru", address: "Jayanagar", ratingAverage: 4.5, offers: [{ price: 899, description: "Haircut + hair spa" }] },
  { name: "The Grooming Room", categories: ["salon"], city: "Bengaluru", address: "Whitefield", ratingAverage: 4.1, offers: [{ price: 799, description: "Premium men's grooming package" }] },
];

async function main() {
  // Safe to wipe: dev seed data only, keeps `npm run db:seed` idempotent.
  await prisma.match.deleteMany({});
  await prisma.offer.deleteMany({});
  await prisma.business.deleteMany({});

  await prisma.user.upsert({
    where: { id: DEV_USER_ID },
    create: { id: DEV_USER_ID, phone: "+910000000001", city: "Bengaluru" },
    update: {},
  });

  for (const b of BUSINESSES) {
    const business = await prisma.business.create({
      data: {
        name: b.name,
        categories: b.categories,
        city: b.city,
        address: b.address,
        verificationStatus: "VERIFIED",
        ratingAverage: b.ratingAverage,
      },
    });

    for (const offer of b.offers) {
      await prisma.offer.create({
        data: {
          businessId: business.id,
          price: offer.price,
          description: offer.description,
        },
      });
    }
  }

  console.log(`Seeded 1 dev user and ${BUSINESSES.length} businesses.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

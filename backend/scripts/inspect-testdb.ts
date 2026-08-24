import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();
const venues = await p.venue.findMany({
  select: { name: true, city: true, _count: { select: { seats: true } } },
});
console.log('VENUES:', JSON.stringify(venues));
const toxic = await p.show.findMany({
  where: { title: 'Toxic' },
  select: { id: true, description: true, _count: { select: { showSeats: true, pricing: true } } },
});
console.log('TOXIC SHOWS:', JSON.stringify(toxic));
const demo = await p.show.count({ where: { description: { contains: '[DEMO]' } } });
console.log('DEMO SHOWS:', demo);
const spidey = await p.show.count({ where: { title: { contains: 'Spider-Man' } } });
console.log('SPIDEY SHOWS:', spidey);
await p.$disconnect();

/**
 * Development seed — creates test users for each role.
 * Run: npx ts-node prisma/seed.ts
 *
 * Passwords (bcrypt, 10 rounds):
 *   admin@lintwise.com   → Admin1234!
 *   premium@lintwise.com → Premium1!
 *   user@lintwise.com    → User1234!
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

async function main() {
  const prisma = new PrismaClient();

  const SALT_ROUNDS = 10;

  const seeds = [
    {
      name: 'Admin User',
      email: 'admin@lintwise.com',
      password: 'Admin1234!',
      role: 'ADMIN' as const,
    },
    {
      name: 'Premium User',
      email: 'premium@lintwise.com',
      password: 'Premium1!',
      role: 'PREMIUM' as const,
    },
    {
      name: 'Regular User',
      email: 'user@lintwise.com',
      password: 'User1234!',
      role: 'USER' as const,
    },
  ];

  for (const seed of seeds) {
    const hashedPassword = await bcrypt.hash(seed.password, SALT_ROUNDS);
    await prisma.user.upsert({
      where: { email: seed.email },
      update: {},
      create: {
        name: seed.name,
        email: seed.email,
        password: hashedPassword,
        role: seed.role,
        isVerified: true,
      },
    });
    console.log(`✅ Seeded: ${seed.email} (${seed.role})`);
  }

  await prisma.$disconnect();
  console.log('\n🌱 Seed complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

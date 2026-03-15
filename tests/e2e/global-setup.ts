import { execSync } from 'child_process';

async function globalSetup() {
  console.log('🌱 Seeding database for E2E tests...');
  try {
    execSync('npx tsx prisma/seed.ts', {
      cwd: process.cwd(),
      stdio: 'inherit',
      timeout: 60_000,
    });
    console.log('✅ Database seeded successfully');
  } catch (error) {
    console.error('❌ Failed to seed database:', error);
    throw error;
  }
}

export default globalSetup;

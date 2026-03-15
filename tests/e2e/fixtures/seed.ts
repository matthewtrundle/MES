import { execSync } from 'child_process';

export function reseedDatabase() {
  execSync('npx tsx prisma/seed.ts', {
    cwd: process.cwd(),
    stdio: 'pipe',
    timeout: 60_000,
  });
}

import { beforeAll, afterAll, vi } from 'vitest';

// Mock environment variables for testing
process.env.DATABASE_URL = 'postgresql://mes:mes_password@localhost:5433/mes';

// Mock Clerk authentication for tests
vi.mock('@clerk/nextjs', () => ({
  auth: () => ({
    userId: 'test-user-id',
    sessionId: 'test-session-id',
  }),
  currentUser: () => ({
    id: 'test-user-id',
    emailAddresses: [{ emailAddress: 'test@example.com' }],
    publicMetadata: { role: 'admin' },
  }),
}));

// Mock next/cache for tests
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

beforeAll(() => {
  console.log('Test suite starting...');
});

afterAll(() => {
  console.log('Test suite complete.');
});

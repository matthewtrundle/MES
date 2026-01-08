// Extend Clerk types to include our custom metadata
export {};

declare global {
  interface CustomJwtSessionClaims {
    metadata?: {
      role?: 'operator' | 'supervisor' | 'admin';
    };
  }
}

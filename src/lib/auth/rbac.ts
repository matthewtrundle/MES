import { prisma } from '@/lib/db/prisma';
import { Role } from '@prisma/client';

// Type for user with sites included
import { User, Site } from '@prisma/client';
export type UserWithSites = User & { sites: Site[] };

const clerkEnabled =
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.includes('REPLACE_ME');

/**
 * Custom HTTP error class for API responses
 */
export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Create a 403 Forbidden error
 */
export function forbidden(message: string = 'Forbidden: Insufficient permissions'): HttpError {
  return new HttpError(403, message);
}

/**
 * Create a 401 Unauthorized error
 */
export function unauthorized(message: string = 'Unauthorized: Not logged in'): HttpError {
  return new HttpError(401, message);
}

/**
 * Get the current user from the database
 * Creates the user if they don't exist (first login)
 */
export async function getCurrentUser() {
  // Demo mode: return the first admin user from the database
  if (!clerkEnabled) {
    const demoUser = await prisma.user.findFirst({
      where: { role: 'admin' },
      include: { sites: true },
    });
    return demoUser;
  }

  const { auth, currentUser } = await import('@clerk/nextjs/server');
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  // Try to find existing user
  let user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: { sites: true },
  });

  // If user doesn't exist, create from Clerk data
  if (!user) {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return null;
    }

    // Get role from Clerk metadata, default to operator
    const role = (clerkUser.publicMetadata?.role as Role) ?? Role.operator;

    user = await prisma.user.create({
      data: {
        clerkId: userId,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? '',
        name: `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() || 'User',
        role,
      },
      include: { sites: true },
    });
  }

  return user;
}

/**
 * Require that the current user has one of the specified roles
 * Throws an error if not authorized
 */
export async function requireRole(allowedRoles: Role[]) {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Unauthorized: Not logged in');
  }

  if (!user.active) {
    throw new Error('Unauthorized: User account is deactivated');
  }

  if (!allowedRoles.includes(user.role)) {
    throw new Error(
      `Unauthorized: Requires one of roles: ${allowedRoles.join(', ')}`
    );
  }

  return user;
}

/**
 * Check if the current user has a specific role (without throwing)
 */
export async function hasRole(role: Role): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === role && user?.active === true;
}

/**
 * Check if the current user has any of the specified roles (without throwing)
 */
export async function hasAnyRole(roles: Role[]): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.active === true && roles.includes(user.role);
}

/**
 * All possible roles (superset — includes roles that may not yet be in Prisma enum)
 */
export type AppRole =
  | 'operator'
  | 'supervisor'
  | 'admin'
  | 'buyer'
  | 'receiving_mgr'
  | 'qa_inspector'
  | 'supply_chain_mgr'
  | 'shipping_coordinator';

export const ALL_ROLES: AppRole[] = [
  'admin',
  'supervisor',
  'operator',
  'buyer',
  'receiving_mgr',
  'qa_inspector',
  'supply_chain_mgr',
  'shipping_coordinator',
];

/**
 * Permission-based access control map
 */
export const ROLE_PERMISSIONS: Record<AppRole, string[]> = {
  admin: ['*'],
  supervisor: [
    'production:read', 'production:write',
    'quality:read', 'quality:write',
    'ncr:disposition',
    'inventory:read',
    'reports:read',
  ],
  operator: ['production:read', 'production:write', 'quality:read'],
  buyer: [
    'purchase_orders:read', 'purchase_orders:write',
    'suppliers:read', 'suppliers:write',
    'inventory:read',
  ],
  receiving_mgr: [
    'receiving:read', 'receiving:write',
    'inventory:read', 'inventory:write',
    'purchase_orders:read',
  ],
  qa_inspector: [
    'quality:read', 'quality:write',
    'iqc:read', 'iqc:write',
    'ncr:read',
  ],
  supply_chain_mgr: [
    'inventory:read', 'inventory:write',
    'purchase_orders:read',
    'suppliers:read',
    'reports:read',
  ],
  shipping_coordinator: [
    'shipping:read', 'shipping:write',
    'production:read',
  ],
};

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(role: AppRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  if (perms.includes('*')) return true;
  return perms.includes(permission);
}

/**
 * Check if the current user has a specific permission
 */
export async function hasPermission(permission: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user || !user.active) return false;
  return roleHasPermission(user.role as AppRole, permission);
}

/**
 * Require a specific permission — throws if the user lacks it
 */
export async function requirePermission(permission: string) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized: Not logged in');
  }
  if (!user.active) {
    throw new Error('Unauthorized: User account is deactivated');
  }
  if (!roleHasPermission(user.role as AppRole, permission)) {
    throw new Error(
      `Unauthorized: Missing permission '${permission}' for role '${user.role}'`
    );
  }
  return user;
}

/**
 * Role hierarchy helpers
 */
export function isOperatorOrAbove(role: Role): boolean {
  // Core production roles + roles that interact with production data
  return [
    'operator', 'supervisor', 'admin',
    'qa_inspector', 'shipping_coordinator',
  ].includes(role);
}

export function isSupervisorOrAbove(role: Role): boolean {
  return [
    'supervisor', 'admin', 'supply_chain_mgr',
  ].includes(role);
}

export function isAdmin(role: Role): boolean {
  return role === 'admin';
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: Role | AppRole): string {
  const displayNames: Record<string, string> = {
    operator: 'Operator',
    supervisor: 'Supervisor',
    admin: 'Administrator',
    buyer: 'Buyer',
    receiving_mgr: 'Receiving Manager',
    qa_inspector: 'QA Inspector',
    supply_chain_mgr: 'Supply Chain Manager',
    shipping_coordinator: 'Shipping Coordinator',
  };
  return displayNames[role] ?? role;
}

/**
 * Get current user or throw if not authenticated
 * Use this in Server Actions that require authentication
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized: Not logged in');
  }
  return user;
}

/**
 * Require role for API routes - throws HttpError with proper status codes
 * Use this in API route handlers for proper HTTP responses
 */
export async function requireRoleApi(allowedRoles: Role[]) {
  const user = await getCurrentUser();

  if (!user) {
    throw unauthorized('Unauthorized: Not logged in');
  }

  if (!user.active) {
    throw forbidden('Forbidden: User account is deactivated');
  }

  if (!allowedRoles.includes(user.role)) {
    throw forbidden(
      `Forbidden: This action requires one of roles: ${allowedRoles.join(', ')}. Your role: ${user.role}`
    );
  }

  return user;
}

/**
 * Get current user for API routes - throws HttpError if not authenticated
 */
export async function requireUserApi() {
  const user = await getCurrentUser();
  if (!user) {
    throw unauthorized('Unauthorized: Not logged in');
  }
  return user;
}

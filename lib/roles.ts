export const USER_ROLES = ["owner", "cashier"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function roleCanAccess(role: UserRole, allowedRoles: readonly UserRole[]) {
  return allowedRoles.includes(role);
}

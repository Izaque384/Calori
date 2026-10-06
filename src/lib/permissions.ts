export type RestaurantRole = "owner" | "manager" | "staff";

export function canManageSettings(role: RestaurantRole) {
  return role === "owner";
}

export function canManageCatalog(role: RestaurantRole) {
  return role === "owner" || role === "manager";
}

export function canManageTables(role: RestaurantRole) {
  return role === "owner" || role === "manager";
}

export function canOperate(role: RestaurantRole) {
  return role === "owner" || role === "manager" || role === "staff";
}

export function canViewReports(role: RestaurantRole) {
  return role === "owner" || role === "manager";
}

export function assertPermission(allowed: boolean) {
  if (!allowed) {
    throw new Error("Você não tem permissão para realizar esta ação.");
  }
}

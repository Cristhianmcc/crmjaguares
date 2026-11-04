import { getPlan, type PlanId } from "./planes";

export interface OrgPlanInfo {
  plan: PlanId;
  trialEndsAt: Date | null;
  planExpiresAt: Date | null;
}

export function isPlanActive(org: OrgPlanInfo): boolean {
  if (org.plan === "trial") {
    if (!org.trialEndsAt) return true;
    return new Date() < org.trialEndsAt;
  }
  if (org.planExpiresAt) {
    return new Date() < org.planExpiresAt;
  }
  return true; // sin fecha de expiración = activo
}

export function getRemainingTrialDays(org: OrgPlanInfo): number | null {
  if (org.plan !== "trial" || !org.trialEndsAt) return null;
  const ms = org.trialEndsAt.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}


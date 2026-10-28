export const SIDEBAR_DEFAULT = 320;
export const SIDEBAR_MIN = 260;
export const SIDEBAR_MAX = 600;
export function sidebarMax(viewport: number): number {
  return Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, viewport - 390));
}
export function clampSidebar(width: number, viewport: number): number {
  return Math.round(Math.min(sidebarMax(viewport), Math.max(SIDEBAR_MIN, Number.isFinite(width) ? width : SIDEBAR_DEFAULT)));
}

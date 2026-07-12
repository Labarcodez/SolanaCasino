/** Bags.fm launchpad helpers. */

export const BAGS_FM_PROFILE_URL = "https://bags.fm/@orbitsolanacasino";

export function getBagsFmTokenUrl(mint: string): string {
  return `https://bags.fm/${mint}`;
}

export function getBagsFmLaunchUrl(profileUrl = BAGS_FM_PROFILE_URL): string {
  return profileUrl;
}

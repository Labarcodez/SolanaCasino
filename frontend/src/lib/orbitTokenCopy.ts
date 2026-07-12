import tokenConfig from "../config/orbit-token.json";

export const ORBIT_TOKEN_COPY = tokenConfig;

/** Paragraphs for the /token page (split on blank lines). */
export function orbitTokenDescriptionParagraphs(): string[] {
  return ORBIT_TOKEN_COPY.description
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

const TEST_WALLET = "HEqvDJ1111111111111111111111111111116fq6";

export function buildTestSessionToken(walletAddress = TEST_WALLET): string {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ walletAddress, sub: walletAddress }));
  return `${header}.${payload}.test-signature`;
}

export { TEST_WALLET };

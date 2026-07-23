export type CognitoConfig = {
  region: string;
  userPoolId: string;
  clientId: string;
  domain: string;
  redirectSignIn: string;
  redirectSignOut: string;
};

export function getCognitoConfig(): CognitoConfig {
  return {
    region: process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
    userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || "",
    clientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || "",
    domain: process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "",
    redirectSignIn: process.env.NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_IN || "",
    redirectSignOut: process.env.NEXT_PUBLIC_COGNITO_REDIRECT_SIGN_OUT || "",
  };
}

export function isCognitoConfigured(): boolean {
  const config = getCognitoConfig();
  return Boolean(config.clientId && config.domain);
}

export function getCognitoAuthUrls() {
  const config = getCognitoConfig();
  const domain = config.domain.replace(/\/$/, "");
  const redirectSignIn = encodeURIComponent(config.redirectSignIn || (typeof window !== "undefined" ? window.location.origin : ""));
  const redirectSignOut = encodeURIComponent(config.redirectSignOut || (typeof window !== "undefined" ? window.location.origin : ""));

  const signInUrl = `${domain}/login?client_id=${config.clientId}&response_type=token&scope=openid+email+profile&redirect_uri=${redirectSignIn}`;
  const signUpUrl = `${domain}/signup?client_id=${config.clientId}&response_type=token&scope=openid+email+profile&redirect_uri=${redirectSignIn}`;
  const signOutUrl = `${domain}/logout?client_id=${config.clientId}&logout_uri=${redirectSignOut}`;

  return { signInUrl, signUpUrl, signOutUrl };
}

const ACCESS_TOKEN_KEY = "lumina_access_token";
const ID_TOKEN_KEY = "lumina_id_token";

export type CognitoUserClaims = {
  sub: string;
  email?: string;
  groups: string[];
  role: "doctor" | "patient";
};

export function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function extractClaimsFromToken(token: string): CognitoUserClaims | null {
  const payload = parseJwtPayload(token);
  if (!payload || typeof payload.sub !== "string" || !payload.sub) return null;

  const rawGroups = payload["cognito:groups"];
  const groups: string[] = Array.isArray(rawGroups) ? rawGroups.map(String) : [];
  const role: "doctor" | "patient" = groups.includes("doctor") ? "doctor" : "patient";

  return {
    sub: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    groups,
    role,
  };
}

export function saveCognitoTokens(accessToken?: string, idToken?: string) {
  if (typeof window === "undefined") return;
  try {
    if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (idToken) localStorage.setItem(ID_TOKEN_KEY, idToken);
  } catch {}
}

export function getStoredCognitoToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ID_TOKEN_KEY) || localStorage.getItem(ACCESS_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function getStoredCognitoClaims(): CognitoUserClaims | null {
  const token = getStoredCognitoToken();
  if (!token) return null;
  return extractClaimsFromToken(token);
}

export function clearCognitoTokens() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(ID_TOKEN_KEY);
  } catch {}
}

export function handleCognitoCallback(): boolean {
  if (typeof window === "undefined") return false;

  const hash = window.location.hash;
  if (!hash || (!hash.includes("access_token") && !hash.includes("id_token"))) {
    return false;
  }

  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const accessToken = params.get("access_token") || undefined;
  const idToken = params.get("id_token") || undefined;

  if (accessToken || idToken) {
    saveCognitoTokens(accessToken, idToken);
    const newUrl = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", newUrl);
    return true;
  }

  return false;
}

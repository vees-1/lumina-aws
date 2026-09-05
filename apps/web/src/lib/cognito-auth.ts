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

export class CognitoAuthError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CognitoAuthError";
  }
}

async function callCognitoPublicApi<T>(
  action: "SignUp" | "ConfirmSignUp" | "ResendConfirmationCode" | "InitiateAuth" | "ForgotPassword" | "ConfirmForgotPassword",
  payload: Record<string, unknown>,
): Promise<T> {
  const config = getCognitoConfig();
  if (!config.clientId) throw new CognitoAuthError("ConfigError", "Cognito is not configured");

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`https://cognito-idp.${config.region}.amazonaws.com/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": `AWSCognitoIdentityProviderService.${action}`,
      },
      body: JSON.stringify({ ClientId: config.clientId, ...payload }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({})) as {
      __type?: string;
      code?: string;
      message?: string;
    };
    if (!response.ok) {
      const code = (data.__type || data.code || `HTTP_${response.status}`).split("#").pop()!;
      throw new CognitoAuthError(code, data.message || "Cognito could not complete the request");
    }
    return data as T;
  } catch (error) {
    if (error instanceof CognitoAuthError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new CognitoAuthError("TimeoutError", "Cognito took too long to respond. Please try again.");
    }
    throw new CognitoAuthError("NetworkError", "Could not reach Cognito. Check your connection and try again.");
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function signUpCognitoUser(input: {
  username: string;
  email: string;
  password: string;
}): Promise<{ userConfirmed: boolean; destination?: string }> {
  const data = await callCognitoPublicApi<{
    UserConfirmed?: boolean;
    CodeDeliveryDetails?: { Destination?: string };
  }>("SignUp", {
    Username: input.username,
    Password: input.password,
    UserAttributes: [{ Name: "email", Value: input.email }],
  });
  return {
    userConfirmed: Boolean(data.UserConfirmed),
    destination: data.CodeDeliveryDetails?.Destination,
  };
}

export async function confirmCognitoSignUp(
  username: string,
  confirmationCode: string,
  role: "doctor" | "patient",
): Promise<void> {
  await callCognitoPublicApi("ConfirmSignUp", {
    Username: username,
    ConfirmationCode: confirmationCode,
    ClientMetadata: { role },
  });
}

export async function resendCognitoConfirmationCode(username: string): Promise<string | undefined> {
  const data = await callCognitoPublicApi<{
    CodeDeliveryDetails?: { Destination?: string };
  }>("ResendConfirmationCode", { Username: username });
  return data.CodeDeliveryDetails?.Destination;
}

export async function signInCognitoUser(
  username: string,
  password: string,
  expectedRole?: "doctor" | "patient",
): Promise<CognitoUserClaims> {
  const data = await callCognitoPublicApi<{
    AuthenticationResult?: {
      AccessToken?: string;
      IdToken?: string;
    };
    ChallengeName?: string;
  }>("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  });
  if (data.ChallengeName) {
    throw new CognitoAuthError(data.ChallengeName, "This account requires an additional sign-in step. Contact support.");
  }
  const accessToken = data.AuthenticationResult?.AccessToken;
  const idToken = data.AuthenticationResult?.IdToken;
  if (!accessToken || !idToken) {
    throw new CognitoAuthError("InvalidAuthenticationResult", "Cognito did not return a valid session.");
  }
  const claims = extractClaimsFromToken(idToken);
  if (!claims) throw new CognitoAuthError("InvalidAuthenticationResult", "Cognito returned an invalid identity token.");
  if (expectedRole && claims.role !== expectedRole) {
    clearCognitoTokens();
    const correctPortal = claims.role === "doctor" ? "doctor" : "patient";
    throw new CognitoAuthError(
      "RoleMismatchException",
      `This is a ${correctPortal} account. Please use the ${correctPortal} login.`,
    );
  }
  saveCognitoTokens(accessToken, idToken);
  return claims;
}

export async function requestCognitoPasswordReset(username: string): Promise<string | undefined> {
  const data = await callCognitoPublicApi<{
    CodeDeliveryDetails?: { Destination?: string };
  }>("ForgotPassword", { Username: username });
  return data.CodeDeliveryDetails?.Destination;
}

export async function confirmCognitoPasswordReset(input: {
  username: string;
  confirmationCode: string;
  password: string;
}): Promise<void> {
  await callCognitoPublicApi("ConfirmForgotPassword", {
    Username: input.username,
    ConfirmationCode: input.confirmationCode,
    Password: input.password,
  });
}

export function getCognitoAuthUrls() {
  const config = getCognitoConfig();
  const domain = config.domain.replace(/\/$/, "");
  const redirectSignIn = encodeURIComponent(config.redirectSignIn || (typeof window !== "undefined" ? window.location.origin : ""));
  const redirectSignOut = encodeURIComponent(config.redirectSignOut || (typeof window !== "undefined" ? window.location.origin : ""));

  const signInUrl = `${domain}/login?client_id=${config.clientId}&response_type=code&scope=openid+email+profile&redirect_uri=${redirectSignIn}`;
  const signUpUrl = `${domain}/signup?client_id=${config.clientId}&response_type=code&scope=openid+email+profile&redirect_uri=${redirectSignIn}`;
  const signOutUrl = `${domain}/logout?client_id=${config.clientId}&logout_uri=${redirectSignOut}`;

  return { signInUrl, signUpUrl, signOutUrl };
}

const PKCE_VERIFIER_KEY = "lumina_pkce_verifier";

function base64Url(bytes: Uint8Array): string {
  let value = "";
  bytes.forEach((byte) => { value += String.fromCharCode(byte); });
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function startCognitoAuthentication(mode: "sign-in" | "sign-up"): Promise<void> {
  const config = getCognitoConfig();
  if (!config.clientId || !config.domain) throw new Error("Cognito is not configured");
  const random = crypto.getRandomValues(new Uint8Array(32));
  const verifier = base64Url(random);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64Url(new Uint8Array(digest));
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  const redirectUri = config.redirectSignIn || window.location.origin;
  const endpoint = mode === "sign-up" ? "signup" : "login";
  const url = `${config.domain.replace(/\/$/, "")}/${endpoint}?client_id=${encodeURIComponent(config.clientId)}&response_type=code&scope=openid+email+profile&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge_method=S256&code_challenge=${encodeURIComponent(challenge)}`;
  window.location.assign(url);
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
    const token = localStorage.getItem(ID_TOKEN_KEY) || localStorage.getItem(ACCESS_TOKEN_KEY) || null;
    if (!token) return null;
    const payload = parseJwtPayload(token);
    if (typeof payload?.exp === "number" && payload.exp * 1_000 <= Date.now()) {
      clearCognitoTokens();
      return null;
    }
    return token;
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

export async function handleCognitoCallback(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const config = getCognitoConfig();
  const code = new URLSearchParams(window.location.search).get("code");
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  if (!code || !verifier || !config.clientId || !config.domain) return false;
  const redirectUri = config.redirectSignIn || window.location.origin;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  const response = await fetch(`${config.domain.replace(/\/$/, "")}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return false;
  const tokens = await response.json() as { access_token?: string; id_token?: string };
  if (!tokens.access_token || !tokens.id_token) return false;
  saveCognitoTokens(tokens.access_token, tokens.id_token);
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  window.history.replaceState(null, "", window.location.pathname);
  return true;
}

"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { type UserRole, writeStoredAuthSession, writeStoredUserRole } from "@/lib/user-role";
import {
  CognitoAuthError,
  confirmCognitoPasswordReset,
  confirmCognitoSignUp,
  isCognitoConfigured,
  requestCognitoPasswordReset,
  resendCognitoConfirmationCode,
  signInCognitoUser,
  signUpCognitoUser,
} from "@/lib/cognito-auth";

const fieldClassName = "h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-500 dark:border-slate-800 dark:bg-slate-950 dark:text-white";

function friendlyCognitoError(error: unknown): string {
  if (!(error instanceof CognitoAuthError)) return "Something went wrong. Please try again.";
  const messages: Record<string, string> = {
    UsernameExistsException: "That username already exists. Confirm the existing account below, or choose a different username.",
    InvalidPasswordException: "Use at least 8 characters with uppercase, lowercase, and a number.",
    InvalidParameterException: "The account details are incomplete. Existing accounts created without an email need administrator help.",
    CodeMismatchException: "That confirmation code is incorrect. Check the email and try again.",
    ExpiredCodeException: "That confirmation code expired. Request a new code below.",
    LimitExceededException: "Too many attempts were made. Wait a few minutes and try again.",
    TooManyRequestsException: "Too many attempts were made. Wait a few minutes and try again.",
    UserNotFoundException: "No signup was found for that username.",
    NotAuthorizedException: "The username or password is incorrect.",
    UserNotConfirmedException: "This account is not confirmed. Use the signup page to confirm it or resend the code.",
    PasswordResetRequiredException: "This account requires a password reset. Use Forgot password below.",
  };
  return messages[error.code] || error.message;
}

function CognitoRegistrationForm({ role, locale }: { role: UserRole; locale: string }) {
  const [step, setStep] = useState<"details" | "confirmation" | "confirmed">("details");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [destination, setDestination] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    writeStoredUserRole(role);
    try {
      const result = await signUpCognitoUser({
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      if (result.userConfirmed) {
        setStep("confirmed");
      } else {
        setDestination(result.destination);
        setStep("confirmation");
        setMessage("We sent a six-digit confirmation code to your email.");
      }
    } catch (cause) {
      if (cause instanceof CognitoAuthError && cause.code === "UsernameExistsException") {
        setStep("confirmation");
      }
      setError(friendlyCognitoError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await confirmCognitoSignUp(username.trim(), confirmationCode.trim(), role);
      setStep("confirmed");
    } catch (cause) {
      setError(friendlyCognitoError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (!username.trim()) {
      setError("Enter the username used during signup first.");
      return;
    }
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const sentTo = await resendCognitoConfirmationCode(username.trim());
      setDestination(sentTo);
      setMessage("A new confirmation code was sent.");
    } catch (cause) {
      setError(friendlyCognitoError(cause));
    } finally {
      setBusy(false);
    }
  }

  if (step === "confirmed") {
    return (
      <div className="grid gap-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[13px] leading-5 text-emerald-800" role="status">
          Your email is confirmed. You can now sign in securely.
        </div>
        <button
          type="button"
          onClick={() => window.location.assign(`/${locale}/sign-in?role=${role}`)}
          className="h-12 rounded-xl bg-cyan-500 text-[15px] text-white transition-colors hover:bg-cyan-400"
        >
          Continue to sign in
        </button>
      </div>
    );
  }

  if (step === "confirmation") {
    return (
      <form className="grid gap-4" onSubmit={handleConfirmation}>
        <div>
          <label htmlFor="confirmation-username" className="mb-1.5 block text-[13px] text-slate-700 dark:text-slate-300">Username</label>
          <input id="confirmation-username" value={username} onChange={(event) => setUsername(event.target.value)} className={fieldClassName} autoComplete="username" required />
        </div>
        <div>
          <label htmlFor="confirmation-code" className="mb-1.5 block text-[13px] text-slate-700 dark:text-slate-300">Confirmation code</label>
          <input id="confirmation-code" value={confirmationCode} onChange={(event) => setConfirmationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className={fieldClassName} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" minLength={6} required />
          <p className="mt-1.5 text-[12px] text-slate-500">{destination ? `Code sent to ${destination}` : "Enter the code sent after signup."}</p>
        </div>
        {message && <p className="rounded-lg border border-cyan-100 bg-cyan-50 p-3 text-[13px] text-cyan-800" role="status">{message}</p>}
        {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700" role="alert">{error}</p>}
        <button type="submit" disabled={busy} className="h-12 rounded-xl bg-cyan-500 text-[15px] text-white transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? "Confirming…" : "Confirm email"}
        </button>
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <button type="button" disabled={busy} onClick={handleResend} className="text-cyan-600 hover:text-cyan-500 disabled:opacity-60">Resend code</button>
          <button type="button" disabled={busy} onClick={() => { setStep("details"); setError(undefined); setMessage(undefined); }} className="text-slate-500 hover:text-slate-700 disabled:opacity-60">Change details</button>
        </div>
      </form>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={handleSignUp}>
      <div>
        <label htmlFor="signup-username" className="mb-1.5 block text-[13px] text-slate-700 dark:text-slate-300">Username</label>
        <input id="signup-username" value={username} onChange={(event) => setUsername(event.target.value)} className={fieldClassName} autoComplete="username" placeholder="Choose a username" required />
      </div>
      <div>
        <label htmlFor="signup-email" className="mb-1.5 block text-[13px] text-slate-700 dark:text-slate-300">Email address</label>
        <input id="signup-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClassName} autoComplete="email" placeholder="you@example.com" required />
        <p className="mt-1.5 text-[12px] text-slate-500">We’ll send your confirmation code here.</p>
      </div>
      <div>
        <label htmlFor="signup-password" className="mb-1.5 block text-[13px] text-slate-700 dark:text-slate-300">Password</label>
        <input id="signup-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={fieldClassName} autoComplete="new-password" minLength={8} placeholder="8+ characters" required />
        <p className="mt-1.5 text-[12px] text-slate-500">Include uppercase, lowercase, and a number.</p>
      </div>
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className="h-12 rounded-xl bg-cyan-500 text-[15px] text-white transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60">
        {busy ? "Creating account…" : "Create account"}
      </button>
      <button type="button" disabled={busy} onClick={() => { setStep("confirmation"); setError(undefined); }} className="text-[13px] text-cyan-600 hover:text-cyan-500 disabled:opacity-60">
        Already signed up? Confirm or resend code
      </button>
    </form>
  );
}

function CognitoSignInForm({ locale, selectedRole }: { locale: string; selectedRole: UserRole }) {
  const [step, setStep] = useState<"sign-in" | "forgot" | "reset">("sign-in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState("");
  const [destination, setDestination] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const claims = await signInCognitoUser(username.trim(), password, selectedRole);
      writeStoredUserRole(claims.role);
      writeStoredAuthSession(true);
      const workspace = selectedRole === "doctor" ? "dashboard" : "patient";
      window.location.assign(`/${locale}/${workspace}`);
    } catch (cause) {
      setError(cause instanceof CognitoAuthError && cause.code === "UserNotFoundException"
        ? "The username or password is incorrect."
        : friendlyCognitoError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      const sentTo = await requestCognitoPasswordReset(username.trim());
      setDestination(sentTo);
      setStep("reset");
      setMessage("We sent a password-reset code to your email.");
    } catch (cause) {
      setError(friendlyCognitoError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await confirmCognitoPasswordReset({
        username: username.trim(),
        confirmationCode: confirmationCode.trim(),
        password,
      });
      setPassword("");
      setConfirmationCode("");
      setStep("sign-in");
      setMessage("Password updated. You can now sign in.");
    } catch (cause) {
      setError(friendlyCognitoError(cause));
    } finally {
      setBusy(false);
    }
  }

  if (step === "forgot") {
    return (
      <form className="grid gap-4" onSubmit={handleForgotPassword}>
        <div>
          <label htmlFor="forgot-username" className="mb-1.5 block text-[13px] text-slate-700 dark:text-slate-300">Username</label>
          <input id="forgot-username" value={username} onChange={(event) => setUsername(event.target.value)} className={fieldClassName} autoComplete="username" required />
          <p className="mt-1.5 text-[12px] text-slate-500">We’ll send a reset code to the email registered with this account.</p>
        </div>
        {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700" role="alert">{error}</p>}
        <button type="submit" disabled={busy} className="h-12 rounded-xl bg-cyan-500 text-[15px] text-white transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? "Sending code…" : "Send reset code"}
        </button>
        <button type="button" disabled={busy} onClick={() => { setStep("sign-in"); setError(undefined); }} className="text-[13px] text-slate-500 hover:text-slate-700 disabled:opacity-60">Back to sign in</button>
      </form>
    );
  }

  if (step === "reset") {
    return (
      <form className="grid gap-4" onSubmit={handlePasswordReset}>
        <div>
          <label htmlFor="reset-username" className="mb-1.5 block text-[13px] text-slate-700 dark:text-slate-300">Username</label>
          <input id="reset-username" value={username} onChange={(event) => setUsername(event.target.value)} className={fieldClassName} autoComplete="username" required />
        </div>
        <div>
          <label htmlFor="reset-code" className="mb-1.5 block text-[13px] text-slate-700 dark:text-slate-300">Reset code</label>
          <input id="reset-code" value={confirmationCode} onChange={(event) => setConfirmationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className={fieldClassName} inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" minLength={6} required />
          <p className="mt-1.5 text-[12px] text-slate-500">{destination ? `Code sent to ${destination}` : "Enter the code sent to your email."}</p>
        </div>
        <div>
          <label htmlFor="reset-password" className="mb-1.5 block text-[13px] text-slate-700 dark:text-slate-300">New password</label>
          <input id="reset-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={fieldClassName} autoComplete="new-password" minLength={8} placeholder="8+ characters" required />
        </div>
        {message && <p className="rounded-lg border border-cyan-100 bg-cyan-50 p-3 text-[13px] text-cyan-800" role="status">{message}</p>}
        {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700" role="alert">{error}</p>}
        <button type="submit" disabled={busy} className="h-12 rounded-xl bg-cyan-500 text-[15px] text-white transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60">
          {busy ? "Updating password…" : "Update password"}
        </button>
        <button type="button" disabled={busy} onClick={() => { setStep("forgot"); setError(undefined); setMessage(undefined); }} className="text-[13px] text-cyan-600 hover:text-cyan-500 disabled:opacity-60">Send another code</button>
      </form>
    );
  }

  return (
    <form className="grid gap-4" onSubmit={handleSignIn}>
      <div>
        <label htmlFor="signin-username" className="mb-1.5 block text-[13px] text-slate-700 dark:text-slate-300">Username</label>
        <input id="signin-username" value={username} onChange={(event) => setUsername(event.target.value)} className={fieldClassName} autoComplete="username" required />
      </div>
      <div>
        <label htmlFor="signin-password" className="mb-1.5 block text-[13px] text-slate-700 dark:text-slate-300">Password</label>
        <input id="signin-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className={fieldClassName} autoComplete="current-password" required />
        <button
          type="button"
          className="mt-2 ml-auto flex items-center gap-1.5 text-[12.5px] text-slate-500 transition-colors hover:text-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
          aria-controls="signin-password"
          aria-pressed={showPassword}
          onClick={() => setShowPassword((visible) => !visible)}
        >
          {showPassword ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
          {showPassword ? "Hide password" : "Show password"}
        </button>
      </div>
      {message && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-[13px] text-emerald-800" role="status">{message}</p>}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700" role="alert">{error}</p>}
      <button type="submit" disabled={busy} className="h-12 rounded-xl bg-cyan-500 text-[15px] text-white transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60">
        {busy ? "Signing in…" : `Sign in as ${selectedRole}`}
      </button>
      <button type="button" disabled={busy} onClick={() => { setStep("forgot"); setError(undefined); setMessage(undefined); }} className="text-[13px] text-cyan-600 hover:text-cyan-500 disabled:opacity-60">Forgot password?</button>
      <a href={`/${locale}/sign-up?role=${selectedRole}`} className="text-center text-[13px] text-slate-500 hover:text-slate-700">Need an account? Sign up with email</a>
    </form>
  );
}

export function StaticAuthForm({
  mode,
  locale,
  role,
}: {
  mode: "sign-in" | "sign-up";
  locale: string;
  role: UserRole;
}) {
  useEffect(() => {
    writeStoredUserRole(role);
  }, [role]);

  const redirectPath = `/${locale}/${role === "patient" ? "patient" : "dashboard"}`;
  const cognitoConfigured = isCognitoConfigured();
  const allowLocalSession = process.env.NODE_ENV !== "production";

  function continueWithLocalSession() {
    writeStoredUserRole(role);
    writeStoredAuthSession(true);
    window.location.assign(redirectPath);
  }

  if (mode === "sign-up" && cognitoConfigured) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <CognitoRegistrationForm role={role} locale={locale} />
      </div>
    );
  }

  if (mode === "sign-in" && cognitoConfigured) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <CognitoSignInForm locale={locale} selectedRole={role} />
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <p className="text-[13px] leading-5 text-slate-500 dark:text-slate-400">
        Cognito is not configured. Accessing the local development workspace:
      </p>
      {allowLocalSession && (
        <button
          type="button"
          onClick={continueWithLocalSession}
          className={cognitoConfigured ? "h-[40px] rounded-lg border border-slate-200 text-[13.5px] font-normal text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900" : "h-[48px] rounded-xl bg-cyan-500 text-[15px] font-normal text-white shadow-lg shadow-cyan-500/25 transition-all hover:bg-cyan-400"}
        >
          {mode === "sign-up" ? "Continue to local workspace" : "Continue with local dev session"}
        </button>
      )}
    </div>
  );
}

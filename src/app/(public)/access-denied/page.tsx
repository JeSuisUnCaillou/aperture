import { LoginButton } from '@/components/chrome/LoginButton';

/**
 * Auth.js error landing page (`pages.error` in `src/lib/auth.ts`). Auth.js maps a
 * genuine gate denial to `?error=AccessDenied`; any other code (e.g.
 * `Configuration`, from a server fault while evaluating the gate) means the
 * sign-in could not be completed rather than that the character was rejected.
 * Denial copy is kept generic — it does not reveal whether the instance is
 * restricted or the character simply isn't on the allowlist.
 */
export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const denied = error === 'AccessDenied';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 text-center">
      <div className="flex max-w-md flex-col items-center gap-3">
        <h1 className="font-heading text-4xl font-semibold tracking-tight">
          {denied ? 'Access not granted' : 'Sign-in unavailable'}
        </h1>
        <p className="text-muted-foreground">
          {denied
            ? 'This Aperture instance is invite-only. Ask an administrator to add your character or corporation to the allowlist, then try again.'
            : 'Something went wrong signing you in. This is usually temporary — please try again in a moment.'}
        </p>
      </div>
      <LoginButton />
    </main>
  );
}

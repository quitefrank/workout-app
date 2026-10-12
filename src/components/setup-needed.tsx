/**
 * Shown in place of the app when a deploy cannot reach its data: either
 * settings are missing (named, never shown) or Supabase refused the
 * first query (its message, which names the problem, not a secret).
 */
export function SetupNeeded({ missing, problem }: { missing: string[]; problem: string | null }) {
  return (
    <main className="mx-auto w-full max-w-[640px] flex-1 px-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 56px)" }}>
      <h1 className="text-[34px] font-bold leading-[41px] tracking-[-0.01em]">Almost there</h1>
      {missing.length > 0 ? (
        <>
          <p className="mt-2 text-[17px] text-ink-2">
            This deploy is missing settings. Add them in Vercel under Settings, Environment Variables, then redeploy.
          </p>
          <ul className="grouped mt-5">
            {missing.map((name) => (
              <li key={name} className="px-4 py-3 font-mono text-[15px]">
                {name}
              </li>
            ))}
          </ul>
          <p className="mt-3 px-4 text-[13px] text-ink-2">
            APP_USER_ID is the id <span className="font-mono">bun run user:create</span> prints.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-[17px] text-ink-2">The settings are in place, but Supabase refused the first request:</p>
          <p className="mt-5 rounded-[20px] bg-card px-4 py-3 font-mono text-[15px] break-words">{problem}</p>
          <p className="mt-3 px-4 text-[13px] text-ink-2">
            Check that the URL and service-role key belong to the same project, and that APP_USER_ID is a user in it.
          </p>
        </>
      )}
    </main>
  );
}

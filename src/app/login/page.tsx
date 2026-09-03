"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const params = useSearchParams();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(false);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passcode }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) {
      window.location.href = params.get("next") || "/";
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="w-80 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <h1 className="text-center text-lg font-bold text-zinc-100">
          <span className="text-amber-400">HSC</span> Sign Mockup Tool
        </h1>
        <p className="mt-1 text-center text-sm text-zinc-500">Staff access</p>
        <input
          type="password"
          autoFocus
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Passcode"
          className="mt-6 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-600"
        />
        {error && (
          <p className="mt-2 text-sm text-red-400">Wrong passcode — try again.</p>
        )}
        <button
          onClick={submit}
          disabled={busy || !passcode}
          className="mt-4 w-full rounded-lg bg-amber-400 py-2 font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-50"
        >
          {busy ? "Checking…" : "Enter"}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

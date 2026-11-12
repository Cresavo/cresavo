"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function AdminActions({
  mode,
  id,
}: {
  mode: "login" | "publish" | "logout";
  id?: string;
}) {
  const [message, setMessage] = useState("");
  const router = useRouter();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const r = await fetch(`/api/admin/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        mode === "login"
          ? { email: form.get("email"), password: form.get("password") }
          : { id },
      ),
    });
    const data = await r.json();
    if (r.ok) router.refresh();
    else setMessage(data.error);
  }
  return (
    <form onSubmit={submit} className="mt-3">
      {mode === "login" && (
        <div className="mb-4">
          <label htmlFor="email">E-post för administratör</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
          />
          <label htmlFor="password">Lösenord</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            maxLength={128}
            required
          />
        </div>
      )}
      <button>
        {mode === "login"
          ? "Logga in"
          : mode === "logout"
            ? "Logga ut"
            : "Publicera"}
      </button>
      <p aria-live="polite">{message}</p>
    </form>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "../components/locale-provider";
import { text } from "@/lib/locale";
import { presentationError } from "@/lib/presentation-errors";
export default function AdminActions({
  mode,
  id,
}: {
  mode: "login" | "publish" | "logout";
  id?: string;
}) {
  const locale = useLocale();
  const t = (en: string, sv: string) => text(locale, en, sv);
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
    else setMessage(presentationError(data.error, locale));
  }
  return (
    <form onSubmit={submit} className="mt-3">
      {mode === "login" && (
        <div className="mb-4">
          <label htmlFor="email">
            {t("Administrator email", "E-post för administratör")}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
          />
          <label htmlFor="password">{t("Password", "Lösenord")}</label>
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
          ? t("Log in", "Logga in")
          : mode === "logout"
            ? t("Log out", "Logga ut")
            : t("Publish", "Publicera")}
      </button>
      <p aria-live="polite">{message}</p>
    </form>
  );
}

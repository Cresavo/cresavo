"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="admin-workspace">
      <h1>Arbetsytan kunde inte hämtas</h1>
      <p role="alert">Försök igen om en stund.</p>
      <button onClick={reset}>Försök igen</button>
    </main>
  );
}

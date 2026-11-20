const languages = {
  en: {
    title: "Let AI book", subtitle: "Try a real booking flow with Salong Eko, a fictional salon.",
    agent: "Start in your assistant", agentBody: "Create a demo key and connect your own assistant. Ask it to find a time and propose a test booking.",
    phone: "Approve on the demo phone", phoneBody: "Open your private phone link. Check the treatment, time and price, then approve the proposal.",
    calendar: "See the booking in your calendar", calendarBody: "Ask the assistant to finish the booking. Refresh the demo phone to see the confirmed time in your own test calendar.",
    start: "Open the sandbox", docs: "Gateway for developers", otherLanguage: "Svenska", otherPath: "/let-ai-book",
    sandboxPath: "/sandbox", note: "All bookings and customers are fictional.",
  },
  sv: {
    title: "Låt AI boka", subtitle: "Prova ett helt bokningsflöde hos den fiktiva salongen Salong Eko.",
    agent: "Börja i din assistent", agentBody: "Skapa en demonyckel och anslut din egen assistent. Be den hitta en ledig tid och föreslå en testbokning.",
    phone: "Godkänn på demotelefonen", phoneBody: "Öppna din privata telefonlänk. Kontrollera behandling, tid och pris och godkänn sedan förslaget.",
    calendar: "Se bokningen i kalendern", calendarBody: "Be assistenten slutföra bokningen. Uppdatera demotelefonen för att se den bekräftade tiden i din egen testkalender.",
    start: "Öppna sandlådan", docs: "Gateway för utvecklare", otherLanguage: "English", otherPath: "/let-ai-book/en",
    sandboxPath: "/sandbox?lang=sv", note: "Alla bokningar och kunder är fiktiva.",
  },
} as const;

export function letAiBookGuide(locale: keyof typeof languages) {
  const t = languages[locale];
  return new Response(`<!doctype html>
  <html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${t.title} · Cresavo</title>
  <style>
    * { box-sizing:border-box } body { margin:0; background:#f7f5f9; color:#221d2a; font:1rem/1.55 system-ui,sans-serif }
    main { width:min(48rem,100%); margin:auto; padding:2rem 1.25rem 4rem } .top { display:flex; justify-content:space-between; color:#5a4056 }
    h1 { font-size:clamp(2.25rem,7vw,4rem); line-height:1.05; margin:2rem 0 1rem; letter-spacing:-.04em }
    .intro { font-size:1.2rem; max-width:34rem } .cards { margin:2rem 0 1rem; padding:0; list-style:none; display:grid; gap:1rem }
    .cards li { padding:1.15rem 1.25rem; border:1px solid #ddd3e2; border-radius:1rem; background:#fff }
    h2 { margin:0; font-size:1.1rem } li p { margin:.35rem 0 0 } a { color:#583858 }
    .links { display:flex; gap:.7rem; flex-wrap:wrap; margin-top:1.25rem } .links a { display:inline-flex; align-items:center; min-height:44px; padding:.55rem 1rem; border-radius:.55rem; border:1px solid #65445e }
    .primary { background:#65445e; color:#fff; text-decoration:none } :focus-visible { outline:3px solid #5b3fbb; outline-offset:3px }
  </style></head><body><main>
  <div class="top"><strong>Cresavo</strong><a href="${t.otherPath}">${t.otherLanguage}</a></div>
  <h1>${t.title}</h1><p class="intro">${t.subtitle}</p>
  <ul class="cards"><li><h2>${t.agent}</h2><p>${t.agentBody}</p></li>
  <li><h2>${t.phone}</h2><p>${t.phoneBody}</p></li><li><h2>${t.calendar}</h2><p>${t.calendarBody}</p></li></ul>
  <p>${t.note}</p><div class="links"><a class="primary" href="https://sandbox.cresavo.com${t.sandboxPath}">${t.start}</a>
  <a href="https://gateway.cresavo.com/llms.txt">${t.docs}</a></div></main></body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" },
  });
}

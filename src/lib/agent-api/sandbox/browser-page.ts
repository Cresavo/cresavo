import { randomBytes } from "node:crypto";
import { sandboxConfig, sandboxHost } from "./config";

const copy = {
  en: {
    app: "Salong Eko sandbox", pairing: "Let an assistant book a test visit", phone: "Demo phone",
    intro: "Create a test key for your assistant, then open your private demo phone to approve the proposal.",
    fictional: "Fictional data only. Nothing is sent or charged.", issue: "Create a demo pair", key: "Agent key",
    once: "Save the agent key now. Copy only this key to your assistant. Keep the phone link private.",
    open: "Open my private demo phone", expires: "Expires", copyKey: "Copy key", copied: "Key copied.",
    pending: "Booking proposals", calendar: "Your sandbox calendar", refresh: "Refresh", approve: "Approve this booking",
    decline: "Decline", empty: "No pending proposals.", calendarEmpty: "No test bookings yet.",
    unavailable: "This link or session is unavailable. Start a new demo pair.",
    wait: "The demo has reached a limit. Try again later.", check: "Check the phone again to see the current status.",
    approved: "Approved. Your assistant can finish the booking.", declined: "Proposal declined.",
    staff: "Staff member", start: "Starts", duration: "Minutes", price: "Price", location: "Location", version: "Service version",
    agent: "Give your assistant the gateway address and your agent key to fetch times and propose a test booking.",
  },
  sv: {
    app: "Salong Ekos sandlåda", pairing: "Låt en assistent boka en testtid", phone: "Demotelefon",
    intro: "Skapa en testnyckel åt assistenten och öppna din privata demotelefon för att godkänna bokningsförslaget.",
    fictional: "Bara fiktiva uppgifter. Inget skickas och inget debiteras.", issue: "Skapa en demonyckel", key: "Agentnyckel",
    once: "Spara agentnyckeln nu. Kopiera bara nyckeln till assistenten. Håll telefonlänken privat.",
    open: "Öppna min privata demotelefon", expires: "Gäller till", copyKey: "Kopiera nyckeln", copied: "Nyckeln är kopierad.",
    pending: "Bokningsförslag", calendar: "Din testkalender", refresh: "Uppdatera", approve: "Godkänn bokningen",
    decline: "Avböj", empty: "Inga förslag att godkänna.", calendarEmpty: "Inga testbokningar ännu.",
    unavailable: "Länken eller sessionen är inte tillgänglig. Skapa en ny demonyckel.",
    wait: "Demon har nått en gräns. Försök igen senare.", check: "Uppdatera telefonen för att se aktuell status.",
    approved: "Godkänt. Assistenten kan nu slutföra bokningen.", declined: "Förslaget har avböjts.",
    staff: "Behandlare", start: "Startar", duration: "Minuter", price: "Pris", location: "Plats", version: "Tjänstens version",
    agent: "Ge assistenten gatewayadressen och agentnyckeln för att hämta tider och föreslå en testbokning.",
  },
} as const;

const style = `
  *, *::before, *::after { box-sizing: border-box } body { margin: 0; background: #f7f5f9; color: #26202e; font-family: system-ui, sans-serif }
  main { max-width: 44rem; padding: 2rem 1.25rem 4rem; margin: auto } h1 { font-size: clamp(1.8rem, 6vw, 2.8rem); line-height: 1.12 }
  p { line-height: 1.55 } .muted { color: #5d5369 } .card { padding: 1rem; background: white; border: 1px solid #ded8e6; border-radius: 1rem; margin: 1rem 0 }
  button, a.action { display: inline-block; min-height: 44px; padding: .7rem 1rem; margin: .25rem .4rem .25rem 0; border-radius: .6rem; border: 1px solid #65445e; font: inherit }
  button { cursor: pointer; color: #fff; background: #65445e } button.secondary { color: #432b42; background: #fff } button:disabled { opacity: .65 }
  a { color: #584050 } input { padding: .65rem; width: 100%; border: 1px solid #a597b0; border-radius: .4rem; margin: .4rem 0; font: inherit } code { overflow-wrap: anywhere }
  dt { font-weight: 600 } dd { margin: 0 0 .45rem } [hidden] { display: none !important } :focus-visible { outline: 3px solid #5b3fbb; outline-offset: 3px }
`;

const commonScript = `
  const byId = id => document.getElementById(id);
  const status = byId("status");
  const date = value => new Intl.DateTimeFormat(document.documentElement.lang, {
    timeZone: "Europe/Stockholm", dateStyle: "medium", timeStyle: "short"
  }).format(new Date(value));
  async function api(path, payload, csrf) {
    const options = { credentials: "same-origin", cache: "no-store", redirect: "error" };
    if (payload !== undefined) {
      options.method = "POST";
      options.headers = { "Content-Type": "application/json" };
      if (csrf) options.headers["X-Sandbox-CSRF"] = csrf;
      options.body = JSON.stringify(payload);
    }
    const response = await fetch(path, options);
    if (!response.ok) throw new Error(response.status === 429 ? t.wait : t.unavailable);
    return response.json();
  }
`;
const pairScript = `
  byId("issue").addEventListener("click", async () => {
    byId("issue").disabled = true;
    try {
      const pair = await api("/api/sandbox/pair", {});
      const phone = new URL(pair.phoneUrl);
      if (phone.origin !== location.origin || phone.pathname !== "/sandbox/phone" || !/^#[A-Za-z0-9_-]{43}$/.test(phone.hash)) throw new Error(t.unavailable);
      if (document.documentElement.lang === "sv") phone.searchParams.set("lang", "sv");
      byId("key").value = pair.agentKey;
      byId("phone").href = phone.href;
      byId("expiry").textContent = date(pair.expiresAt);
      byId("pair").hidden = false;
      status.textContent = "";
    } catch (err) {
      status.textContent = err.message === t.wait ? t.wait : t.unavailable;
      byId("issue").disabled = false;
    }
  });
  byId("copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(byId("key").value);
      status.textContent = t.copied;
    } catch { byId("key").select(); }
  });
`;

const phoneScript = `
  const fragment = location.hash.slice(1);
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  let phoneId = fragment ? "" : new URL(location.href).searchParams.get("phone") || "";
  const validId = value => /^[0-9a-f-]{36}$/.test(value);
  const el = (name, value) => {
    const item = document.createElement(name);
    if (value !== undefined) item.textContent = value;
    return item;
  };
  async function refresh() {
    if (!validId(phoneId)) return;
    byId("refresh").disabled = true;
    try {
      const phone = await api("/api/sandbox/phone?phone=" + phoneId);
      const list = byId("proposals");
      list.replaceChildren();
      byId("customer").textContent = phone.customer;
      if (!phone.proposals.length) list.append(el("p", t.empty));
      for (const item of phone.proposals) {
        const card = el("article");
        card.className = "card";
        card.dataset.proposalId = item.id;
        card.append(el("h3", item.serviceName));
        const terms = el("dl");
        for (const [label, value] of [[t.version, item.serviceVersion], [t.staff, item.staff.name],
          [t.location, item.salon], [t.start, date(item.start)], [t.duration, item.durationMinutes],
          [t.price, new Intl.NumberFormat(document.documentElement.lang, { style: "currency", currency: item.price.currency }).format(item.price.amountMinor / 100)],
          [t.expires, date(item.expiresAt)]]) {
          terms.append(el("dt", label), el("dd", value));
        }
        card.append(terms);
        const approve = el("button", t.approve);
        const decline = el("button", t.decline);
        decline.className = "secondary";
        for (const [button, decision] of [[approve, "yes"], [decline, "no"]]) {
          button.type = "button";
          button.addEventListener("click", async () => {
            approve.disabled = decline.disabled = true;
            try {
              const result = await api("/api/sandbox/phone/decision?phone=" + phoneId, {
                id: item.id, hash: item.proposalHash, decision
              }, phone.csrf);
              status.textContent = result.status === "approved" ? t.approved : t.declined;
              await refresh();
            } catch { status.textContent = t.check; }
          });
          card.append(button);
        }
        list.append(card);
      }
      const calendar = byId("calendar");
      calendar.replaceChildren();
      if (!phone.bookings.length) calendar.append(el("p", t.calendarEmpty));
      for (const row of phone.bookings) {
        const item = el("p", date(row.start) + " · " + row.service);
        item.dataset.bookingId = row.id;
        calendar.append(item);
      }
    } catch (err) {
      status.textContent = err.message === t.wait ? t.wait : t.unavailable;
      byId("proposals").replaceChildren();
      byId("calendar").replaceChildren();
    } finally { byId("refresh").disabled = false; }
  }
  byId("refresh").addEventListener("click", () => { status.textContent = ""; void refresh(); });
  function unavailable() {
    byId("refresh").disabled = true;
    status.textContent = t.unavailable;
  }
  if (fragment) {
    byId("refresh").disabled = true;
    const clean = new URL(location.href);
    clean.searchParams.delete("phone");
    history.replaceState(null, "", clean.pathname + clean.search);
    api("/api/sandbox/phone/redeem", { token: fragment }).then(({ phoneId: id }) => {
      if (!validId(id)) { unavailable(); return; }
      phoneId = id;
      clean.searchParams.set("phone", id);
      history.replaceState(null, "", clean.pathname + clean.search);
      return refresh();
    }, unavailable);
  } else if (validId(phoneId)) { void refresh(); } else { unavailable(); }
`;

function escape(value: string) {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function sandboxPage(request: Request, phone: boolean) {
  let gatewayOrigin: string;
  try {
    const config = sandboxConfig();
    if (!sandboxHost(request, config.origin) || new URL(request.url).origin !== config.origin) throw new Error();
    gatewayOrigin = config.gatewayOrigin;
  }
  catch { return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } }); }
  const locale = new URL(request.url).searchParams.get("lang") === "sv" ? "sv" : "en";
  const t = copy[locale];
  const title = phone ? t.phone : t.pairing;
  const nonce = randomBytes(18).toString("base64url");
  const body = phone
    ? `<p id="customer"></p><button id="refresh" type="button">${escape(t.refresh)}</button>
       <h2>${escape(t.pending)}</h2><section id="proposals"></section>
       <h2>${escape(t.calendar)}</h2><section id="calendar"></section>`
    : `<p>${escape(t.intro)}</p><button type="button" id="issue">${escape(t.issue)}</button>
       <section class="card" id="pair" hidden><p>${escape(t.once)}</p>
       <label for="key">${escape(t.key)}</label><input id="key" readonly autocomplete="off" spellcheck="false">
       <button type="button" id="copy">${escape(t.copyKey)}</button>
       <a id="phone" class="action" target="_blank" rel="noopener noreferrer">${escape(t.open)}</a>
       <p>${escape(t.expires)} <time id="expiry"></time></p>
       <p>${escape(t.agent)} <code id="gateway-origin" data-origin="${escape(gatewayOrigin)}">${escape(gatewayOrigin)}/api/v1/mcp</code></p></section>`;
  const script = "const t = " + JSON.stringify(t).replace(/</g, "\\u003c") + ";" + commonScript + (phone ? phoneScript : pairScript);
  return new Response(`<!doctype html><html lang="${locale}"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
    <title>${escape(title)}</title><style nonce="${nonce}">${style}</style></head><body><main>
    <p class="muted">${escape(t.app)}</p><h1>${escape(title)}</h1>
    <p class="muted">${escape(t.fictional)}</p>
    <p id="status" role="status" aria-live="polite"></p>${body}
    </main><script nonce="${nonce}">${script}</script></body></html>`, { headers: {
    "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow",
    "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`,
  } });
}

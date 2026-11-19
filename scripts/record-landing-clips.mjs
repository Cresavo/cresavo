// Capture only the real product surface. Screenshots give the small text a full
// 2x backing store and make movie timing independent of CI/browser speed.
import { execFileSync } from "node:child_process";
import { copyFile, link, mkdtemp, mkdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const origin = process.env.LANDING_ORIGIN || "http://127.0.0.1:3200";
const output = path.resolve("public/site");
const width = 464, height = 380, viewportHeight = 640, fps = 20;
const clock = new Date("2026-11-18T09:20:00+01:00");
const button = (page, name) => page.getByRole("button", { name, exact: typeof name === "string" });

function camera(page, dir) {
  let y = 64, xCursor = 80, yCursor = 180, frame = 0;
  const file = i => path.join(dir, String(i).padStart(4, "0") + ".png");

  async function snap(count = 1, ripple = 0) {
    // Reattach above native modal dialogs when a new sheet opens.
    await page.evaluate(([x, y, ripple]) => {
      const host = document.querySelector("dialog[open]") || document.body;
      const cursor = document.querySelector("#film-cursor") || document.createElement("div");
      cursor.id = "film-cursor";
      cursor.setAttribute("aria-hidden", "true");
      if (cursor.parentNode !== host) host.append(cursor);
      cursor.style.cssText = `position:fixed;z-index:2147483647;pointer-events:none;left:${x}px;top:${y}px`;
      cursor.innerHTML = `<svg style="position:absolute;left:-22px;top:-22px;overflow:visible" width="46" height="46" viewBox="-22 -22 46 46"><circle r="${3 + 15 * ripple}" fill="none" stroke="#574451" stroke-width="2" opacity="${ripple ? 1-ripple : 0}"/><path d="M0 0 3 19 8 13 15 12 Z" fill="#30282e" stroke="white" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
    }, [xCursor, yCursor, ripple]);
    const first = file(frame++);
    await page.screenshot({ path: first, clip: { x: 0, y, width, height } });
    for (let i = 1; i < count; i++) await link(first, file(frame++));
  }

  async function aim(target, force = false) {
    await target.waitFor();
    const center = async () => {
      const box = await target.boundingBox();
      return { x: box.x + box.width * .58, y: box.y + box.height / 2 };
    };
    let point = await center();
    if (force || point.y < y + 22 || point.y > y + height - 22) {
      await target.evaluate(el => el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
      point = await center();
      y = Math.max(0, Math.min(viewportHeight - height, Math.round(point.y - height * .55)));
    }
    return point;
  }

  async function click(target) {
    const point = await aim(target);
    const startX = xCursor, startY = yCursor;
    for (let i = 1; i <= 9; i++) {
      const t = i / 9, ease = t * t * (3 - 2 * t);
      xCursor = startX + (point.x - startX) * ease;
      yCursor = startY + (point.y - startY) * ease;
      await page.mouse.move(xCursor, yCursor);
      await snap();
    }
    await snap(2, .1);
    for (const ripple of [.32, .58, .85]) await snap(1, ripple);
    await target.click({ position: await target.evaluate(el => ({ x: el.clientWidth * .58, y: el.clientHeight / 2 })) });
  }

  async function type(target, value, chunk = 3) {
    await aim(target);
    await target.fill("");
    for (let i = 0; i < value.length; i += chunk) {
      await target.pressSequentially(value.slice(i, i + chunk));
      await snap(2);
    }
  }

  async function shot(target, count) {
    await aim(target, true);
    await snap(count);
  }

  return { click, type, shot, hold: snap, poster: () => copyFile(file(frame - 1), path.join(dir, "poster.png")), frames: () => frame };
}

export async function bookingScene(page, film, siteOrigin = origin) {
  await page.goto(siteOrigin + "/boka/salong-eko");
  const service = button(page, /^(Book Basic foot care|Boka Enkel fotvård)$/);
  await film.shot(service, 12);
  await film.click(service);
  const visit = page.getByText(/^(Next available appointment|Nästa lediga tid)$/);
  await film.shot(visit, 24);
  await film.poster();
  const guest = page.getByLabel(/^(Your name|Ditt namn)$/);
  await film.shot(guest, 6);
  await film.type(guest, "Nova Demo");
  await film.type(page.getByLabel(/^(Mobile number|Mobilnummer)$/), "0700009912");
  await film.click(button(page, /^(Confirm booking|Bekräfta bokning)$/));
  await film.shot(page.getByRole("heading", { name: /^(You are booked|Din tid är bokad)$/ }), 30);
}

const scenes = {
  booking: bookingScene,
  async day(page, film) {
    await page.goto(origin + "/studio");
    const phone = button(page, "Someone is calling");
    await film.shot(phone, 12);
    await film.click(phone);
    const dialog = page.getByRole("dialog");
    await film.type(dialog.locator("input"), "Agneta Ek");
    await film.click(button(dialog, "Book"));
    await film.click(button(dialog, /Basic foot care/));
    await film.click(button(dialog, "14:45"));
    await film.click(button(dialog, "Book 14:45"));
    await film.shot(button(page, /14:45 Agneta Ek/), 34);
    await film.poster();
  },
  async treatments(page, film) {
    await page.goto(origin + "/studio/more/services");
    const service = button(page, "Edit Spa foot care");
    await film.shot(service, 16);
    await film.click(service);
    const price = page.getByLabel("Price (SEK)");
    await film.shot(price, 12);
    await film.poster();
    await film.click(price);
    await film.type(price, "975", 1);
    await film.hold(9);
    await film.click(button(page.getByRole("dialog"), "Save"));
    await film.shot(service.filter({ hasText: "SEK 975" }), 30);
  },
  async campaign(page, film) {
    await page.goto(origin + "/studio");
    await button(page, /Show \d+ more suggestions/).click();
    const suggestion = page.getByRole("link", { name: "Make an offer" }).first();
    await film.shot(suggestion, 20);
    await film.click(suggestion);
    await film.shot(page.getByRole("heading", { name: "Campaign studio" }), 18);
    const write = button(page, "Write the texts");
    await film.shot(write, 8);
    await film.click(write);
    await film.shot(page.locator("textarea").first(), 32);
    await film.poster();
  },
  async journal(page, film) {
    await page.goto(origin + "/studio/customers");
    const client = page.getByRole("link", { name: /Agneta Ek/ }).first();
    await film.shot(client, 12);
    await film.click(client);
    await film.click(page.getByRole("radio", { name: /^Journal/ }));
    await film.click(button(page, "Write entry"));
    const treatment = page.getByLabel("Treatment", { exact: true });
    await film.shot(treatment, 5);
    await film.type(treatment, "Spa foot care");
    const note = "Prefers morning visits.";
    await film.type(page.getByLabel("Observations"), note);
    await film.click(button(page, "Save"));
    await page.getByText("Journal entry saved", { exact: true }).waitFor({ state: "hidden" });
    await film.shot(page.getByText(note, { exact: true }).first(), 32);
    await film.poster();
  },
};

async function record(browser, name, theme) {
  // Stage on the same filesystem so an interrupted encode preserves the published files.
  const dir = await mkdtemp(path.resolve(".landing-capture-"));
  const context = await browser.newContext({ deviceScaleFactor: 2, viewport: { width, height: viewportHeight }, colorScheme: theme, timezoneId: "Europe/Stockholm", locale: "en-GB" });
  const stem = name === "booking" ? name : name + "-" + theme;
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    await page.clock.setFixedTime(clock);
    const film = camera(page, dir);
    await scenes[name](page, film);
    const duration = film.frames() / fps;
    if (duration < 4 || duration > 8) throw new Error(stem + " duration " + duration);
    const input = ["-hide_banner", "-loglevel", "error", "-y", "-framerate", String(fps), "-i", path.join(dir, "%04d.png")];
    const common = ["-an", "-pix_fmt", "yuv420p", "-threads", "2"];
    for (const [ext, args] of [
      ["mp4", ["-c:v", "libx264", "-preset", "slow", "-crf", "25", "-movflags", "+faststart"]],
      ["webm", ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-row-mt", "1", "-cpu-used", "4"]],
    ]) {
      const encoded = path.join(dir, stem + "." + ext);
      execFileSync("ffmpeg", [...input, ...common, ...args, encoded]);
      if ((await stat(encoded)).size > 600_000) throw new Error(encoded + " exceeds 600 kB");
    }
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", path.join(dir, "poster.png"), "-frames:v", "1", "-c:v", "libwebp", "-quality", "77", path.join(dir, stem + ".webp")]);
    for (const ext of ["mp4", "webm", "webp"]) {
      const file = stem + "." + ext;
      await rename(path.join(dir, file), path.join(output, file));
    }
    console.log(stem, duration + "s");
  } finally {
    await context.close();
    await rm(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  try {
    await mkdir(output, { recursive: true });
    const names = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(scenes);
    for (const name of names) {
      for (const theme of name === "booking" ? ["light"] : ["light", "dark"]) await record(browser, name, theme);
    }
  } finally {
    await browser.close();
  }
}

import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test, expect, type Page } from "@playwright/test";
import { call, connectRequest, moveArgs, sdk, type Proposal } from "./client";

const capture = (page: Page, name: string) => process.env.PAIRING_SCREENSHOTS === "1"
  ? page.screenshot({ path: `docs/design/cresavo/screens/pairing-${name}.jpg`, type: "jpeg", quality: 73 }) : undefined;

test("an owner connects, approves a booking move and a simulated Inbox reply, then disconnects", async ({ page, context }) => {
  await page.goto("/studio/more/data");
  await page.getByRole("button", { name: "Start pairing" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Waiting for assistant" })).toBeVisible();
  await capture(page, "connect");

  let code = "";
  const callback = createServer((req, res) => {
    const url = new URL(req.url!, "http://127.0.0.1");
    if (url.pathname === "/callback") code = url.searchParams.get("code") ?? "";
    res.writeHead(200, { "Content-Type": "text/plain", "Cache-Control": "no-store" }).end("Connected.");
  });
  await new Promise<void>(resolve => callback.listen(0, "127.0.0.1", resolve));
  const port = (callback.address() as AddressInfo).port;
  const registration = await connectRequest(`http://127.0.0.1:${port}/callback`);
  const authPage = await context.newPage();
  await authPage.goto(registration.authorization.href);
  await expect(authPage.getByRole("heading", { name: `Allow 127.0.0.1:${port} to read and draft changes for Salong Eko (demo workspace)` })).toBeVisible();
  await expect(authPage.getByText("Unverified registered client · Studio test assistant")).toBeVisible();
  await expect(authPage.getByRole("listitem")).toHaveCount(9);
  await expect(authPage.getByText("Draft replies for review and simulated sending")).toBeVisible();
  await expect(authPage.getByText("Read aggregate financial figures")).toBeVisible();
  await capture(authPage, "consent");
  try {
    await authPage.getByRole("button", { name: "Allow", exact: true }).click();
    await expect(authPage.getByText("Connected.", { exact: true })).toBeVisible();
    expect(Boolean(code)).toBe(true);
  } finally { callback.close(); }
  await authPage.close();
  const issued = await registration.redeem(code);
  expect(issued.status).toBe(200);
  const client = await sdk(await issued.json());
  try {
    await page.bringToFront();
    await expect(page.getByText("Connected to Studio test assistant")).toBeVisible();
    await page.getByRole("link", { name: "Open Inbox", exact: true }).click();
    await expect(page.getByText("Can I move my Friday appointment?", { exact: true })).toBeVisible();
    const move = await moveArgs(client);
    const draft = await call<Proposal>(client, "propose_reschedule_booking", move);
    await expect(page.getByRole("heading", { name: draft.untrustedCustomerText.title })).toBeVisible({ timeout: 12000 });
    await capture(page, "inbox");
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect.poll(async () => (await call<Proposal>(client, "get_proposal_status", { proposalId: draft.proposalId })).status).toBe("applied");
    const { items } = await call<{ items: { itemId: string }[] }>(client, "list_inbox_items");
    const replyText = "Thanks for writing. We will follow up soon.";
    const reply = await call<Proposal>(client, "propose_reply_to_inbox_item", { itemId: items[1].itemId, replyText, idempotencyKey: randomUUID() });
    await expect(page.getByRole("heading", { name: reply.untrustedCustomerText.title })).toBeVisible({ timeout: 12000 });
    await expect(page.getByText("Written by your assistant", { exact: true })).toBeVisible();
    await expect(page.getByText(replyText, { exact: true })).toBeVisible();
    await expect(page.getByText("Simulate sending in this Inbox", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Approve", exact: true }).click();
    await expect.poll(async () => (await call<Proposal>(client, "get_proposal_status", { proposalId: reply.proposalId })).status).toBe("applied");
    await page.getByRole("link", { name: "View paired calendar" }).click();
    await expect(page.getByLabel("Paired appointment")).toHaveValue(move.bookingId);
    await expect(page.locator("p").filter({ hasText: move.date + " · " + move.time })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Paired appointment")).toHaveValue(move.bookingId);
    await page.goto("/studio/more/data");
    await page.getByRole("button", { name: "Revoke access" }).click();
    await expect(page.getByText("Waiting for assistant", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Disconnect", exact: true }).click();
    await expect(page.getByRole("button", { name: "Start pairing" })).toBeVisible();
    expect(await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith("cresavo-pairing:")))).toEqual([]);
  } finally {
    await client.close();
  }
});

test("an open calendar editor cannot move a booking in a replacement workspace", async ({ page, context }) => {
  await page.goto("/studio/more/data");
  await page.getByRole("button", { name: "Start pairing" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Waiting for assistant" })).toBeVisible();
  await page.goto("/studio/calendar");
  const select = page.getByLabel("Paired appointment");
  const original = await select.inputValue();
  await page.getByRole("button", { name: "Move appointment", exact: true }).click();
  const edit = page.locator('form:has(input[name="date"]):has(input[name="time"])');
  await expect(edit).toBeVisible();

  // Suspend polls until the owner cookie already identifies the replacement.
  await page.route("**/api/pairing/session", route => route.abort());
  const other = await context.newPage();
  await other.goto("/studio/more/data");
  await other.getByRole("button", { name: "Disconnect", exact: true }).click();
  await other.getByRole("button", { name: "Start pairing" }).click();
  await expect(other.getByRole("status").filter({ hasText: "Waiting for assistant" })).toBeVisible();
  await page.unroute("**/api/pairing/session");
  await page.bringToFront();
  await expect(select).not.toHaveValue(original);
  await expect(edit).toHaveCount(0);
  await other.getByRole("button", { name: "Disconnect", exact: true }).click();
});

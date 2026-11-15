import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import { stdin, stdout } from "node:process";
import { DateTime } from "luxon";
import { SendMessageRequest } from "@a2a-js/sdk";
import {
  DefaultAgentCardResolver,
  ClientFactory,
  ClientFactoryOptions,
  JsonRpcTransportFactory,
} from "@a2a-js/sdk/client";
import { startA2aDemo } from "../src/a2a/demo";
import { formatPrice, formatBookingTime } from "../src/lib/format";
import { db } from "../src/lib/db";

async function main() {
  const demo = await startA2aDemo();
  const terminal = createInterface({ input: stdin, output: stdout });
  const answers = terminal[Symbol.asyncIterator]();
  async function question(prompt: string) {
    stdout.write(prompt);
    const next = await answers.next();
    return next.done ? "" : next.value;
  }
  try {
    // The random credential remains in this process and is never printed.
    const authenticated: typeof fetch = (url, init) =>
      fetch(url, {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init?.headers)),
          authorization: `Bearer ${demo.token}`,
        },
      });
    const factory = new ClientFactory({
      ...ClientFactoryOptions.default,
      cardResolver: new DefaultAgentCardResolver({ fetchImpl: authenticated }),
      transports: [new JsonRpcTransportFactory({ fetchImpl: authenticated })],
    });
    const client = await factory.createFromUrl(demo.url);
    async function send(input: unknown) {
      const response = await client.sendMessage(
        SendMessageRequest.fromJSON({
          message: {
            messageId: randomUUID(),
            role: "ROLE_USER",
            parts: [{ text: JSON.stringify(input) }],
          },
        }),
      );
      if (
        !("parts" in response) ||
        response.parts[0]?.content?.$case !== "text"
      )
        throw new Error("A2A_DEMO_RESPONSE_INVALID");
      return JSON.parse(response.parts[0].content.value);
    }
    const [serviceId = "massage", staffId = "staff-demo", date] =
      process.argv.slice(2);
    let day = DateTime.now().setZone("Europe/Stockholm").plus({ days: 1 });
    while (day.weekday > 5) day = day.plus({ days: 1 });
    const result = await send({
      action: "availability",
      serviceId,
      staffId,
      date: date ?? day.toISODate(),
    });
    if (result.error) {
      console.log(result.error.message);
      return;
    }
    const slots: string[] = result.slots;
    if (!slots.length) {
      console.log("Inga lediga tider. Prova en annan dag eller utförare.");
      return;
    }
    console.log(
      "Lokal A2A-demo — endast syntetiska data. Ingen betalning eller utskick.",
    );
    console.log(
      `${result.service.name} · ${result.staff.name} · ${result.service.duration} min · ${formatPrice(result.service.priceOre, "sv")}`,
    );
    slots.forEach((slot, index) =>
      console.log(
        `${index + 1}. ${DateTime.fromISO(slot).setZone("Europe/Stockholm").setLocale("sv").toFormat("cccc d MMMM HH:mm")}`,
      ),
    );
    const choice = await question(
      "Välj tidens nummer, eller Enter för att avsluta utan bokning. ",
    );
    if (!/^[1-9]\d*$/.test(choice)) return;
    const start = slots[Number(choice) - 1];
    if (!start) return;
    console.log(
      `A2A Demo · ${result.service.name} · ${result.staff.name} · ${formatBookingTime(start)} (Stockholm)`,
    );
    if (
      (await question("Skriv BOKA för att bekräfta testbokningen. ")) !== "BOKA"
    )
      return;
    const booking = await send({
      action: "book",
      serviceId,
      staffId,
      start,
      serviceVersion: result.service.version,
      confirmed: true,
      clientRequestId: randomUUID(),
    });
    if (booking.error) {
      console.log(booking.error.message);
      return;
    }
    console.log(`Testbokning klar. Boknings-id ${booking.booking.id}`);
    console.log(
      `Öppna samma lokala webbdatabas på /admin?${new URLSearchParams({ date: DateTime.fromISO(start).setZone("Europe/Stockholm").toISODate()!, staffId, view: "day" })}`,
    );
  } finally {
    terminal.close();
    await demo.close();
  }
}
main()
  .catch(() => {
    console.error("A2A_DEMO_FAILED");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

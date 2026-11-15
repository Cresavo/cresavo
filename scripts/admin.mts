import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { stdin, stdout } from "node:process";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import {
  createAdminUser,
  disableAdminUser,
  resetAdminPassword,
} from "../src/lib/admin-accounts";
import { db } from "../src/lib/db";

// Readline owns terminal editing/raw-mode cleanup; its echoed output is discarded.
// Prompts go explicitly to stdout, while password text never does.
const muted = new Writable({ write: (_chunk, _encoding, done) => done() });
const input = createInterface({
  input: stdin,
  output: muted,
  terminal: !!stdin.isTTY,
  historySize: 0,
  crlfDelay: Infinity,
});
input.on("SIGINT", () => input.close());
const lines = input[Symbol.asyncIterator]();
async function readSecret(label: string): Promise<string> {
  stdout.write(label);
  const line = await lines.next();
  if (line.done) throw new Error("ADMIN_INPUT_CLOSED");
  if (stdin.isTTY) stdout.write("\n");
  return line.value;
}

async function main() {
  const [action, email, extra] = process.argv.slice(2);
  if (
    extra ||
    !email ||
    !["create", "disable", "reset-password"].includes(action)
  )
    throw new Error("ADMIN_COMMAND_INVALID");
  if (action === "disable") await disableAdminUser(email);
  else {
    const password = await readSecret("Lösenord (visas inte): ");
    const confirm = await readSecret("Upprepa lösenord: ");
    if (password !== confirm) throw new Error("ADMIN_PASSWORD_MISMATCH");
    if (action === "create") await createAdminUser(email, password);
    else await resetAdminPassword(email, password);
  }
  stdout.write("ADMIN_COMMAND_OK\n");
}

try {
  await main();
} catch (error) {
  const code =
    error instanceof ZodError
      ? "ADMIN_INPUT_INVALID"
      : error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ? "ADMIN_ACCOUNT_EXISTS"
        : error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2025"
          ? "ADMIN_ACCOUNT_NOT_FOUND"
          : error instanceof Error &&
              [
                "ADMIN_COMMAND_INVALID",
                "ADMIN_PASSWORD_MISMATCH",
                "ADMIN_INPUT_CLOSED",
              ].includes(error.message)
            ? error.message
            : "ADMIN_COMMAND_FAILED";
  console.error(code);
  process.exitCode = 1;
} finally {
  input.close();
  await db.$disconnect().catch(() => {
    console.error("ADMIN_DATABASE_CLOSE_FAILED");
    process.exitCode = 1;
  });
}

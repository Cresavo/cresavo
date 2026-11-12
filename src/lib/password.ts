import { hash, verify, type Options } from "@node-rs/argon2";
import { z } from "zod";
import { PasswordCapacityError } from "./errors";

export const newPasswordSchema = z.string().min(15).max(128);
const policy: Options = {
  algorithm: 2, // Binding enum: Argon2id (const enums cannot be accessed with isolatedModules).
  version: 1, // Binding enum V0x13, i.e. PHC version 19.
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};
// Public dummy, never provisioned as an account. Unknown accounts pay the same KDF cost.
const dummyHash =
  "$argon2id$v=19$m=19456,t=2,p=1$djynxczVM1XvZ1x+A5Bthw$IZoXCc+9S2kbfcv8QXYafofvGv6wmTrVJYi9H343np8";
let running = 0;
async function passwordSlot<T>(operation: () => Promise<T>) {
  if (running >= 4) throw new PasswordCapacityError();
  running++;
  try {
    return await operation();
  } finally {
    running--;
  }
}
export async function hashPassword(password: string) {
  newPasswordSchema.parse(password);
  return passwordSlot(() => hash(password, policy));
}
export async function verifyPasswordHash(
  stored: string | undefined,
  password: string,
) {
  const usable = !!stored?.startsWith("$argon2id$v=19$m=19456,t=2,p=1$");
  const valid = await passwordSlot(() =>
    verify(usable ? stored! : dummyHash, password),
  );
  return usable && valid;
}

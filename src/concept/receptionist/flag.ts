// The deployment switch of the phone receptionist, with no imports, so the
// proxy can read it. Off unless PHONE_RECEPTIONIST_ENABLED=1.

type Env = Record<string, string | undefined>;

export function receptionistEnabled(env: Env = process.env): boolean {
  return env.PHONE_RECEPTIONIST_ENABLED === "1";
}

/** Where a browser test call connects: the Realtime API takes the WebRTC offer directly. */
export const REALTIME_ORIGIN = "https://api.openai.com";

/**
 * The studio's Permissions-Policy while the receptionist is on: the same as
 * everywhere else (`next.config.ts`), except that the studio itself may ask
 * for the microphone. Off, no page of the app can.
 */
export const STUDIO_PERMISSIONS_WITH_MICROPHONE = "camera=(), microphone=(self), geolocation=(), payment=(), usb=(), browsing-topics=()";

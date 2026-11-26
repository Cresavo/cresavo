import type { ClientEvent, ServerEvent } from "./call-session";
import type { CallChannel, CallEnd } from "./types";

// The seam between a call and whatever carries its audio. A transport owns
// the audio path and the Realtime connection; the call session
// (`call-session.ts`) owns everything else. Adding a way to reach the
// receptionist means writing one of these, never changing the session.
//
// Transports:
// - `browser-webrtc.ts`: "Try in the browser". The browser's microphone goes
//   straight to the Realtime API over WebRTC with a short-lived client secret.
// - `elks46.ts`: a stub for 46elks Realtime Voice, where the phone network
//   reaches the server over a WebSocket and the server bridges the audio.
// - SIP: the Realtime API can take a SIP call itself; the server then joins
//   the call's event stream and feeds the same session. Not started.

export interface TransportHandlers {
  /** A Realtime server event. */
  onEvent(event: ServerEvent): void;
  /** The audio is connected and the receptionist can greet. */
  onOpen(): void;
  /** The audio ended without the session asking: the caller hung up or the connection failed. */
  onClose(reason: Extract<CallEnd, "caller" | "error">): void;
}

export interface ReceptionistTransport {
  readonly channel: CallChannel;
  /** Sends a Realtime client event. */
  send(event: ClientEvent): void;
  /** Ends the audio. Safe to call twice. */
  close(): void;
}

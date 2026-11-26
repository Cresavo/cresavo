import type { AudioFormat } from "./realtime-config";
import type { ReceptionistTransport, TransportHandlers } from "./transport";

// Stub for 46elks Realtime Voice (https://46elks.com/docs/realtime-voice).
// Nothing here is connected and no number is bought. It records the protocol
// so the transport can be finished without reading the engine again.
//
// How a call would flow:
// 1. A 46elks virtual number's `voice_start` connects to a websocket number,
//    whose `websocket_url` points at this server (wss://…/receptionist/elks46).
// 2. 46elks opens one WebSocket per call and sends `hello` with the call id
//    and both numbers. The salon is found from `to`.
// 3. The server answers with the audio formats it sends and listens for, then
//    opens a Realtime WebSocket with the same session config as a browser
//    test (`realtimeSession`), and relays `audio` in both directions.
// 4. Realtime server events go to the call session; the client events it
//    returns go to the Realtime socket. `hangUp` sends `bye` to 46elks.
//
// A long-lived WebSocket needs a long-running server process; a serverless
// function cannot hold a call.

/** Messages 46elks sends to the server. All carry `t`, not `type`. */
export type ElksInbound =
  | { t: "hello"; callid: string; from: string; to: string }
  | { t: "audio"; data: string }
  /** Answer to our `sync`: everything sent before it has been played. */
  | { t: "sync" }
  | { t: "bye"; reason: "done" | "hangup" | "error"; message?: string };

/** Messages the server sends to 46elks. */
export type ElksOutbound =
  | { t: "sending"; format: ElksFormat }
  | { t: "listening"; format: ElksFormat }
  | { t: "audio"; data: string }
  /** Drops audio not yet played, when the caller starts talking over the receptionist. */
  | { t: "interrupt" }
  | { t: "sync" }
  | { t: "bye" };

type ElksFormat = "pcm_24000" | "ulaw" | "alaw";

/** 24 kHz PCM on both legs needs no transcoding between 46elks and the Realtime API. */
export const ELKS_FORMAT: ElksFormat = "pcm_24000";
export const ELKS_REALTIME_FORMAT: AudioFormat = { type: "audio/pcm", rate: 24000 };

export class Elks46NotConnected extends Error {
  constructor() {
    super("The 46elks transport is a stub: no phone number is connected.");
  }
}

/** Throws until the transport is built. The signature is the one the server route will call per incoming WebSocket. */
export const elks46Transport: (socket: unknown, handlers: TransportHandlers) => ReceptionistTransport = () => {
  throw new Elks46NotConnected();
};

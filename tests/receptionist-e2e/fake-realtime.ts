import type { Page } from "@playwright/test";

// A stand-in for the Realtime API inside the page: a second peer connection
// that answers the studio's WebRTC offer and speaks the event protocol over
// the same "oai-events" data channel. The spec scripts what the model "says"
// and which tools it calls; the studio's own code is untouched.

interface Fake {
  /** Client events the studio sent, oldest first. */
  received: { type: string; item?: { type?: string; call_id?: string; output?: string }; response?: { instructions?: string } }[];
  send(event: unknown): void;
  /** The Authorization header the studio connected with. */
  authorization: string | null;
}

export async function installFakeRealtime(page: Page) {
  await page.addInitScript(() => {
    const fake: Fake = { received: [], send: () => undefined, authorization: null };
    (window as unknown as { fakeRealtime: Fake }).fakeRealtime = fake;
    const Native = window.RTCPeerConnection;
    // The first connection the page opens is the studio's own.
    const opened: RTCPeerConnection[] = [];
    window.RTCPeerConnection = class extends Native {
      constructor(config?: RTCConfiguration) {
        super(config);
        opened.push(this);
      }
    };
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url !== "https://api.openai.com/v1/realtime/calls") return nativeFetch(input, init);
      fake.authorization = new Headers(init?.headers).get("authorization");
      const studio = opened[0];
      const model = new Native();
      model.ondatachannel = ({ channel }) => {
        channel.onmessage = (message) => fake.received.push(JSON.parse(String(message.data)));
        fake.send = (event) => channel.send(JSON.stringify(event));
      };
      model.onicecandidate = ({ candidate }) => { if (candidate) void studio.addIceCandidate(candidate); };
      studio.onicecandidate = ({ candidate }) => { if (candidate) void model.addIceCandidate(candidate); };
      await model.setRemoteDescription({ type: "offer", sdp: String(init?.body) });
      const answer = await model.createAnswer();
      await model.setLocalDescription(answer);
      return new Response(answer.sdp, { status: 201, headers: { "Content-Type": "application/sdp" } });
    };
  });
}

/** What the scripted model says aloud: the studio gets the transcript, as it would after the audio. */
export const says = (page: Page, transcript: string) =>
  page.evaluate((text) => (window as unknown as { fakeRealtime: Fake }).fakeRealtime.send({ type: "response.output_audio_transcript.done", transcript: text }), transcript);

/** What the caller said, as the transcription reports it. */
export const hears = (page: Page, transcript: string) =>
  page.evaluate((text) => (window as unknown as { fakeRealtime: Fake }).fakeRealtime.send({ type: "conversation.item.input_audio_transcription.completed", transcript: text }), transcript);

let calls = 0;

/** The scripted model calls a tool; resolves with what the studio's engine answered. */
export async function callsTool(page: Page, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const callId = `call_${++calls}`;
  await page.evaluate(({ name, args, callId }) => {
    (window as unknown as { fakeRealtime: Fake }).fakeRealtime.send({
      type: "response.done",
      response: { usage: { output_token_details: { audio_tokens: 200 } }, output: [{ type: "function_call", name, call_id: callId, arguments: JSON.stringify(args) }] },
    });
  }, { name, args, callId });
  const output = await page.waitForFunction((id) => {
    const reply = (window as unknown as { fakeRealtime: Fake }).fakeRealtime.received.find((event) => event.item?.type === "function_call_output" && event.item.call_id === id);
    return reply?.item?.output ?? false;
  }, callId);
  return JSON.parse(await output.jsonValue() as string) as Record<string, unknown>;
}

/** The greeting instruction the studio sent when the line opened. */
export async function greeting(page: Page): Promise<string> {
  const handle = await page.waitForFunction(() => (window as unknown as { fakeRealtime: Fake }).fakeRealtime.received.find((event) => event.type === "response.create")?.response?.instructions ?? false);
  return await handle.jsonValue() as string;
}

export const authorization = (page: Page) => page.evaluate(() => (window as unknown as { fakeRealtime: Fake }).fakeRealtime.authorization);

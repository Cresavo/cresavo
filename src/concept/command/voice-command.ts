// Lets the floating microphone (in the studio shell) hand a spoken command to
// the command box on the current page.

type Listener = (text: string) => void;

let listener: Listener | null = null;

export function onVoiceCommand(next: Listener): () => void {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}

export function sendVoiceCommand(text: string) {
  listener?.(text);
}

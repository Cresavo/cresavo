const ENGLISH_PATH = /^\/(?:studio|boka|unknown-address)(?:\/|$)/;

export function englishConceptPath(pathname: string): boolean {
  return ENGLISH_PATH.test(pathname);
}

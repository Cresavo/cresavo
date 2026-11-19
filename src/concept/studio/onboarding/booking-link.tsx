import { dispatch } from "../../store";

export function recordShare(slug: string) {
  dispatch({ type: "card/dismiss", id: `shared:${slug}` });
}

import type { Adapter, PortResult, UtcTimestamp } from "../core";

export type SocialCapability = "post-image" | "instagram" | "facebook";
export type SocialChannel = "instagram" | "facebook";

export interface SocialPost {
  channel: SocialChannel;
  caption: string;
  /** Public HTTPS JPEG or PNG the platform fetches itself. */
  imageUrl: string;
  /** Our campaign id; used to make retries findable. */
  reference: string;
}

export interface PublishedPost {
  postId: string;
  publishedAt?: UtcTimestamp;
}

export interface SocialPort extends Adapter<SocialCapability> {
  publish(post: SocialPost): Promise<PortResult<PublishedPost>>;
}

import type { Review } from "../data/types";

export function reviewSummary(reviews: Review[]): { average: number; count: number } {
  reviews = reviews.filter(review => review.approved !== false);
  const count = reviews.length;
  return { average: count ? reviews.reduce((sum, r) => sum + r.rating, 0) / count : 0, count };
}

/** "Maria L." – customers are shown by first name and initial only. */
export function publicName(firstName: string, lastName: string): string {
  return lastName ? `${firstName} ${lastName[0]}.` : firstName;
}

/** The newest reviews that have text, newest first. */
export function recentReviews(reviews: Review[], limit: number): Review[] {
  return reviews
    .filter((r) => r.approved !== false && r.text.trim())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

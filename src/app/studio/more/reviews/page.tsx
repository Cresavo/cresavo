import { redirect } from "next/navigation";

export default function ReviewsPage() {
  redirect("/studio/inbox?filter=reviews");
}

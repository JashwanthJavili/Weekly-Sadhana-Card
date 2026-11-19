import { Suspense } from "react";
import CardEditor from "./CardEditor";

// `/card?week=YYYY-MM-DD` — a query param keeps the site fully static for Firebase Hosting.
export default function CardPage() {
  return (
    <Suspense fallback={<div className="mx-auto mt-20 h-[70vh] w-full max-w-[860px] animate-pulse rounded-2xl bg-white/60" />}>
      <CardEditor />
    </Suspense>
  );
}

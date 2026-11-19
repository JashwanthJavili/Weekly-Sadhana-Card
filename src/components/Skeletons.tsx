/* Loading placeholders for the home page, shaped like the real rows so nothing jumps when they load. */

const box = "shrink-0 rounded-2xl bg-white shadow-sm ring-1 ring-black/5";
const bar = "skeleton block rounded-full";

/** Same size as the Google sign-in / account row. */
export function AccountSkeleton() {
  return (
    <div className={`${box} flex h-[54px] items-center gap-3 px-3`} aria-hidden>
      <span className="skeleton h-9 w-9 shrink-0 rounded-full" />
      <span className="flex flex-1 flex-col gap-1.5">
        <span className={`${bar} h-3 w-36 max-w-[70%]`} />
        <span className={`${bar} h-2.5 w-48 max-w-[85%]`} />
      </span>
    </div>
  );
}

/** Same size as the streak card. */
export function StreakSkeleton() {
  return (
    <div className={`${box} flex h-[62px] items-center gap-2.5 px-3`} aria-hidden>
      <span className="skeleton h-10 w-10 shrink-0 rounded-full" />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className={`${bar} h-3.5 w-24`} />
        <span className={`${bar} h-2.5 w-32 max-w-[90%]`} />
      </span>
      <span className="flex shrink-0 gap-[3px]">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="skeleton h-[15px] w-[15px] rounded-full max-[359px]:h-3 max-[359px]:w-3" />
        ))}
      </span>
    </div>
  );
}

/** Rows shaped like saved cards, with a quiet status line for screen readers. */
export function CardListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading your cards…</span>
      <ul className="space-y-2" aria-hidden>
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className={`${box} flex h-[61px] items-center gap-3 px-3`} style={{ opacity: 1 - i * 0.25 }}>
            <span className="skeleton h-10 w-10 shrink-0 rounded-full" />
            <span className="flex flex-1 flex-col gap-1.5">
              <span className={`${bar} h-3 w-32 max-w-[70%]`} />
              <span className={`${bar} h-2.5 w-20`} />
            </span>
            <span className="skeleton mr-2 h-1.5 w-1.5 rounded-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}

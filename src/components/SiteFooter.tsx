export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`screen-only bg-brand px-4 py-3 text-center text-white ${className}`}>
      <p className="font-serif text-[14px] tracking-wide">
        In Service of <span className="font-bold">HG Pranavananda Prabhuji</span>
      </p>
    </footer>
  );
}

export function SiteFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`bg-brand px-4 py-3 text-center text-white ${className}`}>
      <p className="font-serif text-[14px] tracking-wide whitespace-nowrap max-[359px]:text-[12.5px] max-[359px]:tracking-normal">
        In Service of <span className="font-bold">HG Pranavananda Prabhuji</span>
      </p>
    </footer>
  );
}

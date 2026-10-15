// the grab bar on top of a phone bottom sheet — the visual half of
// lib/use-sheet-dismiss.ts. hidden from sm up, where sheets are centred modals.
export default function SheetHandle() {
  return (
    <div
      aria-hidden="true"
      className="sm:hidden absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-stone-300 z-30 pointer-events-none"
    />
  );
}

interface PageFlipControlsProps {
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export function PageFlipControls({
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
}: PageFlipControlsProps) {
  return (
    <>
      <button
        type="button"
        className="page-corner page-corner--left"
        onClick={onPrev}
        disabled={!canGoPrev}
        aria-label="Перелистнуть назад"
      />
      <button
        type="button"
        className="page-corner page-corner--right"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Перелистнуть вперёд"
      />
    </>
  );
}

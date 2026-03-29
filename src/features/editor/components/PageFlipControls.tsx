interface PageFlipControlsProps {
  canGoPrev: boolean;
  canGoNext?: boolean;
  onPrev: () => void;
  onNext: () => void;
  prevLabel?: string;
  nextLabel?: string;
}

export function PageFlipControls({
  canGoPrev,
  canGoNext = true,
  onPrev,
  onNext,
  prevLabel = "Назад",
  nextLabel = "Вперёд",
}: PageFlipControlsProps) {
  return (
    <>
      <button
        type="button"
        className="page-corner page-corner--left"
        onClick={onPrev}
        disabled={!canGoPrev}
        aria-label="Перелистнуть назад"
      >
        <span className="page-corner__shadow" aria-hidden="true" />
        <span className="page-corner__fold" aria-hidden="true" />
        <span className="page-corner__label">{prevLabel}</span>
      </button>

      <button
        type="button"
        className="page-corner page-corner--right"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Перелистнуть вперёд"
      >
        <span className="page-corner__shadow" aria-hidden="true" />
        <span className="page-corner__fold" aria-hidden="true" />
        <span className="page-corner__label">{nextLabel}</span>
      </button>
    </>
  );
}

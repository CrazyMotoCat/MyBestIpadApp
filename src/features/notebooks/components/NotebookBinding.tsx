import { BindingPresetId } from "@/shared/types/presets";

interface NotebookBindingProps {
  bindingType: BindingPresetId;
  className?: string;
}

export function NotebookBinding({ bindingType, className = "" }: NotebookBindingProps) {
  const baseClassName = `binding ${className}`.trim();

  if (bindingType === "clip") {
    return <div className={`${baseClassName} binding--clip`.trim()} aria-hidden="true" />;
  }

  if (bindingType === "rings") {
    return (
      <div className={`${baseClassName} binding--rings`.trim()} aria-hidden="true">
        {Array.from({ length: 5 }).map((_, index) => (
          <span key={index} />
        ))}
      </div>
    );
  }

  return (
    <div className={`${baseClassName} binding--spiral`.trim()} aria-hidden="true">
      {Array.from({ length: 10 }).map((_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}

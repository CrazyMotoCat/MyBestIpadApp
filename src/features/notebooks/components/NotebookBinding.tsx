import { BindingPresetId } from "@/shared/types/presets";

interface NotebookBindingProps {
  bindingType: BindingPresetId;
}

export function NotebookBinding({ bindingType }: NotebookBindingProps) {
  if (bindingType === "clip") {
    return <div className="binding binding--clip" aria-hidden="true" />;
  }

  if (bindingType === "rings") {
    return (
      <div className="binding binding--rings" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    );
  }

  return (
    <div className="binding binding--spiral" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}

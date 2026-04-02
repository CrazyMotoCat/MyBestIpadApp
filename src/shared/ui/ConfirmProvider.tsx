import { PropsWithChildren, createContext, useContext, useMemo, useState } from "react";
import { Button } from "@/shared/ui/Button";
import { Modal } from "@/shared/ui/Modal";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: PropsWithChildren) {
  const [pendingConfirm, setPendingConfirm] = useState<ConfirmState | null>(null);

  const confirm = useMemo<ConfirmFn>(
    () => (options) =>
      new Promise<boolean>((resolve) => {
        setPendingConfirm({
          ...options,
          resolve,
        });
      }),
    [],
  );

  function closeConfirm(result: boolean) {
    setPendingConfirm((current) => {
      current?.resolve(result);
      return null;
    });
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pendingConfirm ? (
        <Modal title={pendingConfirm.title} isOpen={true} onClose={() => closeConfirm(false)}>
          <div className="confirm-dialog">
            <div className="confirm-dialog__message">{pendingConfirm.message}</div>
            <div className="confirm-dialog__actions">
              <Button variant="ghost" onClick={() => closeConfirm(false)}>
                {pendingConfirm.cancelText ?? "Отмена"}
              </Button>
              <Button onClick={() => closeConfirm(true)}>{pendingConfirm.confirmText ?? "Продолжить"}</Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);

  if (!context) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }

  return context;
}

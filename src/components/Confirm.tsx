import { useCallback, useState } from "react";
import Modal from "./Modal";

interface ConfirmState {
  message: string;
  resolve: (ok: boolean) => void;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const ask = useCallback(
    (message: string): Promise<boolean> =>
      new Promise((resolve) => setState({ message, resolve })),
    [],
  );

  const accept = () => {
    state?.resolve(true);
    setState(null);
  };

  const cancel = () => {
    state?.resolve(false);
    setState(null);
  };

  const ConfirmDialog = state ? (
    <Modal
      title="Confirmar ação"
      onClose={cancel}
      width={400}
      footer={
        <>
          <button className="btn btn-ghost" onClick={cancel}>
            Cancelar
          </button>
          <button className="btn btn-danger" onClick={accept}>
            Confirmar
          </button>
        </>
      }
    >
      <p style={{ margin: 0, color: "var(--text)", lineHeight: 1.6 }}>{state.message}</p>
    </Modal>
  ) : null;

  return { ask, ConfirmDialog };
}

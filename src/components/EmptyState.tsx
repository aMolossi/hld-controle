import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon, title, body, action }: Props) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <strong>{title}</strong>
      <p className="empty-body">{body}</p>
      {action && (
        <button className="btn btn-primary empty-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

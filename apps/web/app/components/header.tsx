import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icon";

export function Header({
  title,
  back,
  action,
}: {
  title: string;
  back?: string;
  action?: ReactNode;
}) {
  return (
    <header className={`app-header ${back ? "centered" : ""}`}>
      {back ? (
        <Link href={back} className="icon-button back" aria-label="Go back">
          <Icon name="back" />
        </Link>
      ) : null}
      <h1>{title}</h1>
      <div className="header-action">{action}</div>
    </header>
  );
}

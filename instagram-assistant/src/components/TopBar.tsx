import Link from "next/link";
import { systemState } from "@/lib/services/system";
import { Icon } from "./Icon";

/** Page header with the always-visible automation status pill. */
export async function TopBar({ title, backHref }: { title: string; backHref?: string }) {
  const state = await systemState();
  return (
    <header className="topbar">
      {backHref ? (
        <Link href={backHref} aria-label="Back" className="pill" style={{ padding: 0, width: 44, justifyContent: "center", border: 0, background: "transparent" }}>
          <Icon name="back" />
        </Link>
      ) : null}
      <h1>{title}</h1>
      <Link href="/rules" className="pill">
        <span className={state.automationOn ? "dot" : "dot off"} />
        {state.automationOn ? "Automation on" : "Paused"}
      </Link>
    </header>
  );
}

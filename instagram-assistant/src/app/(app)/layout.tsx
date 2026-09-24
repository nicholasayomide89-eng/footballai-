import { BottomNav } from "@/components/BottomNav";
import { requireOwnerPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireOwnerPage();
  return (
    <>
      <div className="shell">{children}</div>
      <BottomNav />
    </>
  );
}

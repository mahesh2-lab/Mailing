import { redirect } from "next/navigation";
import { getAuthSession } from "@/src/lib/require-auth";
import { db } from "@/src";
import { userSettings } from "@/src/db/schema";
import { eq } from "drizzle-orm";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await getAuthSession();
  
  if (!session?.user) {
    redirect("/login");
  }
  
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, session.user.id)
  });
  
  if (!settings) {
    redirect("/onboarding");
  }

  return <>{children}</>;
}

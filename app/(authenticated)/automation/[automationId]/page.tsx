"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function AutomationSingularRedirect() {
  const params = useParams();
  const router = useRouter();
  const automationId = params?.automationId;

  useEffect(() => {
    if (automationId) {
      router.replace(`/automations/${automationId}`);
    } else {
      router.replace("/automations");
    }
  }, [automationId, router]);

  return null;
}

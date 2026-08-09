"use client";

import PlanEditor from "@/components/PlanEditor";

export default function MessageScheduleEditorPage({ params }) {
  return <PlanEditor planId={params.planId} mode="signs" />;
}

"use client";

import PlanEditor from "@/components/PlanEditor";

export default function DotPlanEditorPage({ params }) {
  return <PlanEditor planId={params.planId} mode="dots" />;
}

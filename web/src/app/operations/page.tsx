"use client";

import CityMap from "@/components/ops/CityMap";
import KpiBar from "@/components/ops/KpiBar";
import Controls from "@/components/ops/Controls";
import EventFeed from "@/components/ops/EventFeed";
import IncidentList from "@/components/ops/IncidentList";

export default function OperationsPage() {
  return (
    <div className="space-y-4">
      <KpiBar />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr_300px]">
        <div className="space-y-4">
          <Controls />
          <IncidentList />
        </div>
        <CityMap />
        <EventFeed />
      </div>
    </div>
  );
}

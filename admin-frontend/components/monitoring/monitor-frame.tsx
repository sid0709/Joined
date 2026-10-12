"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Banner, PageHeader, PageTabs, Selector, Skeleton, Stack, Text } from "sid-ui";
import { formatDateTime } from "@/lib/format";
import {
  DEFAULT_MONITORING_RANGE,
  SYSTEM_REFRESH_MS,
  parseMonitoringRange,
  systemPath,
  type MonitoringRange,
  type SystemSnapshot,
} from "@/lib/monitoring";
import { ROUTES } from "@/lib/nav";
import { useAdminQuery } from "@/lib/use-admin-query";

const UNCONFIGURED = 503;
const RANGE_WIDTH = 180;
const MS_PER_SECOND = 1000;

export const MONITORING_TABS = [
  { value: "overview", label: "Overview", href: ROUTES.monitoring },
  { value: "host", label: "Host", href: ROUTES.monitoringHost },
  { value: "traffic", label: "Traffic", href: ROUTES.monitoringTraffic },
  { value: "data", label: "Data", href: ROUTES.monitoringData },
  { value: "product", label: "Product", href: ROUTES.monitoringProduct },
  { value: "incidents", label: "Incidents", href: ROUTES.statusIncidents },
] as const;

/** The shared tab row. Incidents does not load the Prometheus snapshot. */
export function MonitoringTabs({ value }: { value: string }) {
  return <PageTabs tabs={[...MONITORING_TABS]} value={value} label="Monitoring" />;
}

/**
 * Loads the system snapshot, refreshes it while the page is open, and renders
 * one monitoring view once the data is here.
 */
export function MonitorFrame({
  title,
  description,
  tab,
  ranges,
  children,
}: {
  title: string;
  description: string;
  tab: (typeof MONITORING_TABS)[number]["value"];
  ranges: readonly { value: MonitoringRange; label: string }[];
  children: (snapshot: SystemSnapshot, range: MonitoringRange) => ReactNode;
}) {
  const [range, setRange] = useState<MonitoringRange>(DEFAULT_MONITORING_RANGE);
  const { result, loading, error, errorStatus, reload } = useAdminQuery<SystemSnapshot>(
    systemPath(range),
  );

  useEffect(() => {
    const timer = setInterval(reload, SYSTEM_REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const header = (
    <Stack gap={4}>
      <PageHeader
        title={title}
        description={
          result
            ? `${description} Updated ${formatDateTime(result.at)}. Refreshes every ${SYSTEM_REFRESH_MS / MS_PER_SECOND} seconds.`
            : description
        }
        action={
          <Selector
            label="Range"
            isLabelHidden
            options={[...ranges]}
            value={range}
            onChange={(value) => setRange(parseMonitoringRange(value))}
            size="sm"
            width={RANGE_WIDTH}
          />
        }
      />
      <MonitoringTabs value={tab} />
    </Stack>
  );

  if (!result) {
    return (
      <Stack gap={5}>
        {header}
        {error ? (
          <Banner
            status={errorStatus === UNCONFIGURED ? "info" : "error"}
            title={
              errorStatus === UNCONFIGURED
                ? "System monitoring is off"
                : "Could not load system health"
            }
            description={error}
          />
        ) : (
          <Skeleton height={320} />
        )}
      </Stack>
    );
  }

  return (
    <Stack gap={5}>
      {header}
      {loading ? (
        <Text type="supporting" color="secondary">
          Refreshing…
        </Text>
      ) : null}
      {children(result, range)}
    </Stack>
  );
}

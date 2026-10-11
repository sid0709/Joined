"use client";

import { useEffect, useState } from "react";
import {
  Banner,
  GridColumn,
  GridSystem,
  PageHeader,
  Selector,
  Skeleton,
  Stack,
  Text,
} from "sid-ui";
import { formatDateTime } from "@/lib/format";
import {
  DEFAULT_MONITORING_RANGE,
  MONITORING_RANGES,
  SYSTEM_REFRESH_MS,
  formatMs,
  formatPercent,
  formatRate,
  formatShare,
  parseMonitoringRange,
  systemPath,
  type SystemSnapshot,
} from "@/lib/monitoring";
import { useAdminQuery } from "@/lib/use-admin-query";
import { ApiTrafficCard, SlowRoutesCard } from "./api-tables";
import { HostStats } from "./host-stats";
import { ContainersCard, DataServicesCard } from "./infra-cards";
import { MonitorChart } from "./monitor-chart";
import { ServiceStatusCard } from "./service-status";

const UNCONFIGURED = 503;
const RANGE_WIDTH = 180;
const MS_PER_SECOND = 1000;

/** System health from Prometheus, refreshed every SYSTEM_REFRESH_MS while open. */
export function SystemMonitor() {
  const [range, setRange] = useState(DEFAULT_MONITORING_RANGE);
  const { result, loading, error, errorStatus, reload } = useAdminQuery<SystemSnapshot>(
    systemPath(range),
  );

  useEffect(() => {
    const timer = setInterval(reload, SYSTEM_REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const header = (
    <PageHeader
      title="System"
      description={
        result
          ? `Updated ${formatDateTime(result.at)} · refreshes every ${SYSTEM_REFRESH_MS / MS_PER_SECOND} seconds`
          : "VPS, containers, APIs, and data services."
      }
      action={
        <Selector
          label="Range"
          isLabelHidden
          options={[...MONITORING_RANGES]}
          value={range}
          onChange={(value) => setRange(parseMonitoringRange(value))}
          size="sm"
          width={RANGE_WIDTH}
        />
      }
    />
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

  const { charts } = result;
  return (
    <Stack gap={5}>
      {header}
      {loading ? (
        <Text type="supporting" color="secondary">
          Refreshing…
        </Text>
      ) : null}

      <ServiceStatusCard services={result.services ?? []} />
      <HostStats host={result.host} />

      <GridSystem gap={5} align="start">
        <GridColumn span="full" lg={6}>
          <MonitorChart
            title="CPU and memory"
            lines={charts?.host}
            range={range}
            formatValue={formatPercent}
          />
        </GridColumn>
        <GridColumn span="full" lg={6}>
          <MonitorChart
            title="Requests per second"
            lines={charts?.traffic}
            range={range}
            formatValue={(value) => formatRate(value)}
          />
        </GridColumn>
        <GridColumn span="full" lg={6}>
          <MonitorChart
            title="Latency"
            lines={charts?.latency}
            range={range}
            formatValue={formatMs}
          />
        </GridColumn>
        <GridColumn span="full" lg={6}>
          <MonitorChart
            title="Server errors"
            description="Share of requests answered with a 5xx."
            lines={charts?.errors}
            range={range}
            formatValue={formatShare}
          />
        </GridColumn>
      </GridSystem>

      <ApiTrafficCard apis={result.apis ?? []} />
      <SlowRoutesCard routes={result.routes ?? []} />
      <GridSystem gap={5} align="start">
        <GridColumn span="full" lg={6}>
          <ContainersCard containers={result.containers ?? []} />
        </GridColumn>
        <GridColumn span="full" lg={6}>
          <DataServicesCard data={result.data} />
        </GridColumn>
      </GridSystem>
    </Stack>
  );
}

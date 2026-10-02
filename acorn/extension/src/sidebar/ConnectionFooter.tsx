import { Collapsible, HStack, StatusDot, Text, TextInput, VStack } from "@joined/design-system";
import type { PipelineProgress } from "@acorn/shared/pipeline-types";
import { DEFAULT_ATHENS_API_URL, setAthensApiUrl } from "../auth/acorn-auth";

type ConnectionFooterProps = {
  phase: PipelineProgress["phase"];
  connected: boolean;
  signedIn: boolean;
  status: string;
  apiUrl: string;
  onApiUrlChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
};

/** Footer strip: connection dot and status; expands to the API URL and socket state. */
export function ConnectionFooter({
  phase,
  connected,
  signedIn,
  status,
  apiUrl,
  onApiUrlChange,
  onOpenChange,
}: ConnectionFooterProps) {
  return (
    <footer className={`status-bar phase-${phase}`}>
      <Collapsible
        chevronPosition="end"
        onOpenChange={onOpenChange}
        trigger={
          <HStack gap={2} align="center">
            <StatusDot
              variant={connected ? "success" : "neutral"}
              label={connected ? "Connected" : "Offline"}
            />
            <Text weight="semibold">Connection</Text>
            <Text type="supporting" maxLines={1}>
              {status}
            </Text>
          </HStack>
        }
      >
        <VStack gap={2}>
          <TextInput
            label="Acorn API URL"
            value={apiUrl}
            onChange={(value) => {
              onApiUrlChange(value);
              void setAthensApiUrl(value);
            }}
            placeholder={DEFAULT_ATHENS_API_URL}
          />
          <HStack gap={2} align="center">
            <StatusDot
              variant={connected ? "success" : "neutral"}
              label={connected ? "Socket connected" : "Socket offline"}
            />
            <Text type="supporting">
              {connected ? "Socket connected" : signedIn ? "Socket offline" : "Sign in to connect"}
            </Text>
          </HStack>
        </VStack>
      </Collapsible>
    </footer>
  );
}

import { Code, Text, VStack } from "@joined/design-system";

import { useActiveTab } from "../../api/activeTab";
import { routineMatchesUrl } from "../../routineKit/match";
import { ROUTINES } from "../../routines";

import RoutineCard from "./RoutineCard";

/** Every routine the crawler knows, with the one for the focused tab marked. */
export default function RoutineLibrary() {
  const activeTab = useActiveTab();
  const count = ROUTINES.length;

  return (
    <VStack gap={3}>
      <VStack gap={0.5}>
        <Text as="h2" type="large" weight="semibold">
          Routines
        </Text>
        <Text type="supporting" color="secondary">
          {count} {count === 1 ? "routine teaches" : "routines teach"} the crawler a site. Add one
          in <Code size="inherit">src/routines/</Code> and list it in{" "}
          <Code size="inherit">src/routines/index.js</Code>.
        </Text>
      </VStack>
      {ROUTINES.map((routine) => (
        <RoutineCard
          key={routine.id}
          routine={routine}
          isActive={Boolean(activeTab && routineMatchesUrl(routine, activeTab.url))}
        />
      ))}
    </VStack>
  );
}

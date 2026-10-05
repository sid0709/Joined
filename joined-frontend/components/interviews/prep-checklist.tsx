"use client";

import { CheckboxInput, HStack, ProgressBar, Stack, Text } from "sid-ui";
import type { PrepTask } from "@/lib/interviews";

/** Prep tasks with a progress bar; toggling a task reports the whole list. */
export function PrepChecklist({
  tasks,
  onChange,
}: {
  tasks: PrepTask[];
  onChange: (tasks: PrepTask[]) => void;
}) {
  if (tasks.length === 0) return null;
  const done = tasks.filter((task) => task.done).length;

  return (
    <Stack gap={3}>
      <HStack hAlign="between" vAlign="center">
        <Text type="label">Prep</Text>
        <Text type="supporting" color="secondary" hasTabularNumbers>
          {done} of {tasks.length} done
        </Text>
      </HStack>
      <ProgressBar
        label="Prep progress"
        isLabelHidden
        value={done}
        max={tasks.length}
        variant={done === tasks.length ? "success" : "accent"}
      />
      <Stack gap={2}>
        {tasks.map((task) => (
          <CheckboxInput
            key={task.id}
            label={task.label}
            value={task.done}
            onChange={(checked) =>
              onChange(
                tasks.map((item) => (item.id === task.id ? { ...item, done: checked } : item)),
              )
            }
          />
        ))}
      </Stack>
    </Stack>
  );
}

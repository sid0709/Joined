"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Banner,
  Button,
  HStack,
  Selector,
  Stack,
  Text,
  useToast,
} from "@openseat/design-system";
import { fetchJobAccess, fetchJobs, saveJobAccess } from "@/lib/company/api";
import {
  ROLE_META,
  INVITABLE_ROLES,
  type JobAccessAssignment,
  type TeamMember,
  type TeamRole,
} from "@/lib/rbac";

/**
 * Per-job access overrides. Empty assignment = inherit company role.
 * Live GET/PUT /v1/company/jobs/:id/access (jobs.edit | team.manage_roles on PUT).
 */
export function JobAccessPanel({ members, canEdit }: { members: TeamMember[]; canEdit: boolean }) {
  const toast = useToast();
  const [jobId, setJobId] = useState("");
  const [jobOptions, setJobOptions] = useState<{ value: string; label: string }[]>([]);
  const [assignments, setAssignments] = useState<JobAccessAssignment[]>([]);
  const [memberId, setMemberId] = useState("");
  const [roleHint, setRoleHint] = useState<TeamRole>("interviewer");

  useEffect(() => {
    let active = true;
    fetchJobs()
      .then((jobs) => {
        if (!active) return;
        const options = jobs.map((job) => ({ value: job.id, label: job.title }));
        setJobOptions(options);
        setJobId((current) => current || options[0]?.value || "");
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
    return () => {
      active = false;
    };
  }, [toast]);

  useEffect(() => {
    if (!jobId) return;
    let active = true;
    fetchJobAccess(jobId)
      .then((doc) => {
        if (active) setAssignments(doc.assignments);
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
    return () => {
      active = false;
    };
  }, [jobId, toast]);

  const memberOptions = useMemo(
    () =>
      members
        .filter((member) => !member.isPending)
        .map((member) => ({
          value: member.id,
          label: member.isYou ? `${member.name} (you)` : member.name,
        })),
    [members],
  );

  const roleOptions = INVITABLE_ROLES.map((role) => ({
    value: role,
    label: ROLE_META[role].label,
  }));

  const add = () => {
    if (!memberId || !canEdit) return;
    if (assignments.some((item) => item.memberId === memberId)) {
      toast({ body: "That person already has a per-job override.", type: "error" });
      return;
    }
    setAssignments((current) => [...current, { memberId, roleHint }]);
  };

  const remove = (id: string) => {
    setAssignments((current) => current.filter((item) => item.memberId !== id));
  };

  const save = () => {
    if (!jobId || !canEdit) return;
    saveJobAccess(jobId, assignments)
      .then((doc) => {
        setAssignments(doc.assignments);
        toast({ body: "Job access saved." });
      })
      .catch((error: Error) => toast({ body: error.message, type: "error" }));
  };

  return (
    <Stack gap={4}>
      <Banner
        status="info"
        title="Per-job permissions"
        description="Overrides sit on top of the company role. Leave someone off this list to inherit their team role. Empty permissions on save also inherit."
      />
      <Selector
        label="Job"
        options={jobOptions}
        value={jobId}
        onChange={setJobId}
        isDisabled={jobOptions.length === 0}
      />
      {!canEdit ? (
        <Text type="supporting" color="secondary">
          Your role cannot edit per-job access.
        </Text>
      ) : (
        <HStack gap={3} wrap="wrap" vAlign="end">
          <Selector
            label="Teammate"
            options={memberOptions}
            value={memberId}
            onChange={setMemberId}
          />
          <Selector
            label="Role on this job"
            options={roleOptions}
            value={roleHint}
            onChange={(value) => setRoleHint(value as TeamRole)}
          />
          <Button label="Add override" variant="secondary" onClick={add} isDisabled={!memberId} />
        </HStack>
      )}
      <Stack gap={2}>
        {assignments.length === 0 ? (
          <Text type="supporting" color="secondary">
            No overrides — everyone inherits their company role on this job.
          </Text>
        ) : (
          assignments.map((item) => {
            const member = members.find((row) => row.id === item.memberId);
            return (
              <HStack key={item.memberId} hAlign="between" vAlign="center" gap={3} wrap="wrap">
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Text weight="medium">{member?.name || item.memberId}</Text>
                  {item.roleHint ? (
                    <Badge label={ROLE_META[item.roleHint].label} variant="purple" />
                  ) : (
                    <Badge label="Custom permissions" variant="blue" />
                  )}
                </HStack>
                {canEdit ? (
                  <Button
                    label="Remove"
                    variant="ghost"
                    size="sm"
                    onClick={() => remove(item.memberId)}
                  />
                ) : null}
              </HStack>
            );
          })
        )}
      </Stack>
      {canEdit ? (
        <HStack hAlign="end">
          <Button label="Save job access" variant="primary" onClick={save} isDisabled={!jobId} />
        </HStack>
      ) : null}
    </Stack>
  );
}

"use client";

import type { ReactNode } from "react";
import { ClickableCard } from "./Container";
import { Card, Heading, Stack, Text, type CardVariant } from "./Primitives";

/** Card width in px, or any CSS width. */
type Width = number | string;

export interface JobCardProps {
  title: string;
  meta?: string;
  /** Status, badges, or anything that describes the room at a glance. */
  children?: ReactNode;
  footer?: ReactNode;
  /** Makes the whole card a link. */
  href?: string;
  /** Makes the whole card a button. */
  onClick?: () => void;
  /** Tints the card to mark the chosen room or bid. */
  selected?: boolean;
  /** Lifts the card — only for a card that overlaps content beneath it. */
  raised?: boolean;
  width?: Width;
}

/** The OpenSeat room card: title, meta line, optional body and footer, on an Astryx Card. */
export function JobCard({ title, meta, children, footer, href, onClick, selected, raised, width }: JobCardProps) {
  const variant: CardVariant = selected ? "blue" : "default";
  const elevation = raised ? "low" : undefined;
  const body = (
    <Stack gap={2}>
      <Stack gap={0.5}>
        <Heading level={4}>{title}</Heading>
        {meta && (
          <Text type="supporting" color="secondary">
            {meta}
          </Text>
        )}
      </Stack>
      {children}
      {footer && (
        <Text type="supporting" color="secondary">
          {footer}
        </Text>
      )}
    </Stack>
  );

  if (href || onClick) {
    return (
      <ClickableCard label={title} href={href} onClick={onClick} variant={variant} elevation={elevation} width={width}>
        {body}
      </ClickableCard>
    );
  }
  return (
    <Card variant={variant} elevation={elevation} width={width}>
      {body}
    </Card>
  );
}

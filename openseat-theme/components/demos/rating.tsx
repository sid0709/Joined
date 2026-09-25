"use client";

import { useState } from "react";
import { Avatar, Badge, Button, Card, HStack, Heading, ProgressBar, Rating, Stack, Text, TextArea } from "@openseat/design-system";
import { Caption, Examples, PEOPLE, Preview } from "./shared";

const CAPTIONS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];
const BREAKDOWN = [
  { stars: 5, count: 128 },
  { stars: 4, count: 41 },
  { stars: 3, count: 9 },
  { stars: 2, count: 3 },
  { stars: 1, count: 2 },
];
const TOTAL = BREAKDOWN.reduce((sum, b) => sum + b.count, 0);
const AVERAGE = BREAKDOWN.reduce((sum, b) => sum + b.stars * b.count, 0) / TOTAL;
const CRITERIA = ["Communication", "Quality", "On time", "Value"];
const BIDDERS = [
  { ...PEOPLE[0], score: 5, reviews: 42, price: "$2,400" },
  { ...PEOPLE[1], score: 4, reviews: 18, price: "$2,150" },
  { ...PEOPLE[2], score: 3, reviews: 7, price: "$2,900" },
];

export default function RatingDemo() {
  const [score, setScore] = useState(4);
  const [ten, setTen] = useState(7);
  const [criteria, setCriteria] = useState<Record<string, number>>({ Communication: 5, Quality: 4, "On time": 0, Value: 0 });
  const [review, setReview] = useState("");
  const [sent, setSent] = useState(false);
  const rated = Object.values(criteria).filter(Boolean).length;

  return (
    <Examples>
      <Preview label="Interactive">
        <Rating value={score} onChange={setScore} caption={CAPTIONS[score]} />
      </Preview>
      <Preview label="Read only">
        <Stack gap={3}>
          <Rating value={5} readOnly label="Client rating" caption="Excellent" />
          <Rating value={3} readOnly size="sm" showValue={false} label="Fit" />
        </Stack>
      </Preview>
      <Preview label="Sizes">
        <Stack gap={3}>
          <Rating value={4} readOnly size="sm" />
          <Rating value={4} readOnly size="md" />
          <Rating value={4} readOnly size="lg" />
        </Stack>
      </Preview>
      <Preview label="Ten marks">
        <Rating value={ten} max={10} onChange={setTen} label="Confidence" />
      </Preview>

      <Preview label="Review summary" description="An average, the star breakdown as bars, and the total.">
        <Card maxWidth={440}>
          <HStack gap={6} vAlign="center" wrap="wrap">
            <Stack gap={1} hAlign="center">
              <Text type="display-2">{AVERAGE.toFixed(1)}</Text>
              <Rating value={Math.round(AVERAGE)} readOnly size="sm" showValue={false} label="Average rating" />
              <Caption>{TOTAL} reviews</Caption>
            </Stack>
            <Stack gap={1} width={220}>
              {BREAKDOWN.map((b) => (
                <HStack key={b.stars} gap={2} vAlign="center">
                  <Stack width={24}>
                    <Text type="supporting" hasTabularNumbers>
                      {b.stars}★
                    </Text>
                  </Stack>
                  <Stack width="100%">
                    <ProgressBar label={`${b.stars} stars`} isLabelHidden value={b.count} max={TOTAL} variant={b.stars >= 4 ? "success" : b.stars === 3 ? "warning" : "error"} />
                  </Stack>
                  <Stack width={32}>
                    <Caption>{b.count}</Caption>
                  </Stack>
                </HStack>
              ))}
            </Stack>
          </HStack>
        </Card>
      </Preview>

      <Preview label="Compare bidders" description="Read-only ratings beside each bid, small and without the number.">
        <Card maxWidth={480}>
          <Stack gap={3}>
            {BIDDERS.map((b) => (
              <HStack key={b.name} hAlign="between" vAlign="center" gap={3} wrap="wrap">
                <HStack gap={2} vAlign="center">
                  <Avatar name={b.name} size="sm" tooltip={false} />
                  <Stack gap={0}>
                    <Text weight="semibold">{b.name}</Text>
                    <HStack gap={1} vAlign="center">
                      <Rating value={b.score} readOnly size="sm" showValue={false} label={`${b.name}’s rating`} />
                      <Caption>({b.reviews})</Caption>
                    </HStack>
                  </Stack>
                </HStack>
                <HStack gap={2} vAlign="center">
                  {b.score === 5 && <Badge label="Top rated" variant="success" />}
                  <Text hasTabularNumbers>{b.price}</Text>
                </HStack>
              </HStack>
            ))}
          </Stack>
        </Card>
      </Preview>

      <Preview label="Leave a review" description="One rating per criterion, a note, and a submit that waits for every score.">
        <Card maxWidth={440}>
          {sent ? (
            <Stack gap={2}>
              <Heading level={4}>Thanks for your review</Heading>
              <Text color="secondary">Alex Rivera will see it on their profile.</Text>
              <HStack>
                <Button label="Edit review" size="sm" variant="ghost" onClick={() => setSent(false)} />
              </HStack>
            </Stack>
          ) : (
            <Stack gap={3}>
              <Heading level={4}>How did Alex Rivera do?</Heading>
              {CRITERIA.map((c) => (
                <HStack key={c} hAlign="between" vAlign="center">
                  <Text>{c}</Text>
                  <Rating value={criteria[c]} onChange={(v) => setCriteria((all) => ({ ...all, [c]: v }))} label={c} showValue={false} caption={CAPTIONS[criteria[c]]} />
                </HStack>
              ))}
              <TextArea label="Anything else?" isOptional rows={3} value={review} onChange={setReview} />
              <HStack hAlign="between" vAlign="center">
                <Caption>
                  {rated} of {CRITERIA.length} rated
                </Caption>
                <Button label="Submit review" variant="primary" isDisabled={rated < CRITERIA.length} onClick={() => setSent(true)} />
              </HStack>
            </Stack>
          )}
        </Card>
      </Preview>
    </Examples>
  );
}

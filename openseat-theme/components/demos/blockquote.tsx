"use client";

import { Avatar, Blockquote, Card, Code, HStack, Heading, Link, Stack, Text } from "@openseat/design-system";
import { Examples, PEOPLE, Preview } from "./shared";

const TESTIMONIALS = [
  { quote: "We cut our vendor search from three weeks to four days.", person: PEOPLE[0] },
  { quote: "Sealed bids meant we finally saw honest pricing.", person: PEOPLE[1] },
  { quote: "The room did the chasing so I didn’t have to.", person: PEOPLE[2] },
];

export default function BlockquoteDemo() {
  return (
    <Examples>
      <Preview label="Plain" description="An inline-start rule and secondary text set the passage apart.">
        <Blockquote>Start anywhere. Change anything. Ship faster.</Blockquote>
      </Preview>

      <Preview label="With attribution" description="cite renders in a <cite> element after the quote.">
        <Blockquote cite="Jordan Miles, room owner">Every bid arrived sealed, so the decision was about the work — not who spoke first.</Blockquote>
      </Preview>

      <Preview label="Rich attribution" description="cite accepts any node — a link, a role, a source.">
        <Blockquote
          cite={
            <>
              Dana Kim, <Link href="#case-study">Northwind case study</Link>
            </>
          }
        >
          OpenSeat turned a messy email thread into one room with a clear deadline.
        </Blockquote>
      </Preview>

      <Preview label="Inline formatting" description="Links, code, and emphasis keep working inside the quote.">
        <Blockquote cite="Release notes">
          Rooms now close automatically at the deadline. Set <Code>autoClose</Code> to <Code>false</Code> to keep one open, or{" "}
          <Link href="#deadlines">read about deadlines</Link>.
        </Blockquote>
      </Preview>

      <Preview label="Several paragraphs">
        <Blockquote cite="From the OpenSeat brief">
          <Stack gap={2}>
            <Text display="block">Invite only the people you trust. They see the brief; nobody sees each other’s bid.</Text>
            <Text display="block">When the room closes, compare bids side by side and award in one click.</Text>
          </Stack>
        </Blockquote>
      </Preview>

      <Preview label="In an article" description="Sits in the reading flow between body paragraphs.">
        <Stack gap={3}>
          <Heading level={3}>Why sealed bidding works</Heading>
          <Text display="block">
            Open bidding rewards speed, not quality. The first number anchors every number that follows, and late bidders shade toward it.
          </Text>
          <Blockquote cite="Priya Nair, strategist">Hide the anchor and you get each bidder’s real price.</Blockquote>
          <Text display="block">Sealed rooms keep every bid private until the deadline, then reveal them together.</Text>
        </Stack>
      </Preview>

      <Preview label="Testimonials" description="Quotes in cards, with an avatar in the attribution.">
        <HStack gap={3} wrap="wrap" vAlign="stretch">
          {TESTIMONIALS.map(({ quote, person }) => (
            <Card key={person.name} maxWidth={280}>
              <Blockquote
                cite={
                  <HStack gap={2} vAlign="center">
                    <Avatar name={person.name} size="sm" tooltip={false} />
                    <span>
                      {person.name}, {person.role}
                    </span>
                  </HStack>
                }
              >
                {quote}
              </Blockquote>
            </Card>
          ))}
        </HStack>
      </Preview>
    </Examples>
  );
}

"use client";

import { useRef, useState } from "react";
import {
  Avatar,
  Badge,
  Blockquote,
  Button,
  Card,
  Carousel,
  HStack,
  Heading,
  Icon,
  IconButton,
  JobCard,
  Stack,
  Text,
  Thumbnail,
  icons,
  type CardVariant,
  type CarouselHandle,
} from "@openseat/design-system";
import { Caption, Examples, PEOPLE, Preview, SAMPLE_IMAGES } from "./shared";

const SLIDE_WIDTH = 220;
const WIDE_SLIDE = 320;
const TONES: CardVariant[] = ["blue", "teal", "green", "yellow", "orange", "pink", "purple", "cyan"];
const SLIDES = TONES.map((tone, index) => ({ tone, title: `Slide ${index + 1}` }));

const ROOMS = [
  { title: "Brand refresh", meta: "Fixed · $2,400", tag: "Design", variant: "blue" as const },
  { title: "Landing page copy", meta: "Hourly · $65/hr", tag: "Copy", variant: "purple" as const },
  { title: "Motion system", meta: "Fixed · $3,200", tag: "Motion", variant: "teal" as const },
  { title: "Pitch deck", meta: "Fixed · $950", tag: "Design", variant: "blue" as const },
  { title: "Onboarding flow", meta: "Fixed · $4,100", tag: "Product", variant: "orange" as const },
  { title: "Email templates", meta: "Hourly · $50/hr", tag: "Copy", variant: "purple" as const },
];

const QUOTES = [
  { quote: "We cut vendor search from three weeks to four days.", person: PEOPLE[0] },
  { quote: "Sealed bids meant honest pricing, finally.", person: PEOPLE[1] },
  { quote: "The room did the chasing so I didn’t have to.", person: PEOPLE[2] },
  { quote: "Our first award took an afternoon.", person: PEOPLE[3] },
];

const STEPS = [
  { icon: icons.edit, title: "Write the brief", body: "Describe the job, the budget, and the deadline." },
  { icon: icons.user, title: "Invite people", body: "Only invitees see the room. Nobody sees each other." },
  { icon: icons.lock, title: "Collect sealed bids", body: "Bids stay hidden until the room closes." },
  { icon: icons.check, title: "Award in one click", body: "Compare side by side and pick the best fit." },
];

const IMAGES = [SAMPLE_IMAGES.globe, SAMPLE_IMAGES.window, SAMPLE_IMAGES.file, SAMPLE_IMAGES.globe, SAMPLE_IMAGES.window, SAMPLE_IMAGES.file, SAMPLE_IMAGES.globe];

function Slide({ tone, title, width = SLIDE_WIDTH }: { tone: CardVariant; title: string; width?: number }) {
  return (
    <Card variant={tone} width={width} minHeight={120}>
      <Stack gap={1}>
        <Text weight="semibold">{title}</Text>
        <Text type="supporting" color="secondary">
          {tone}
        </Text>
      </Stack>
    </Card>
  );
}

export default function CarouselDemo() {
  const handle = useRef<CarouselHandle>(null);
  const [step, setStep] = useState(0);

  const go = (index: number) => {
    const next = Math.max(0, Math.min(STEPS.length - 1, index));
    setStep(next);
    handle.current?.scrollTo(next);
  };

  return (
    <Examples>
      <Preview label="Default" description="A horizontal scroller with previous and next buttons.">
        <Carousel aria-label="Colors">
          {SLIDES.map((slide) => (
            <Slide key={slide.title} {...slide} />
          ))}
        </Carousel>
      </Preview>

      <Preview label="Gap and padding" description="gap spaces the slides; padding insets the track so the first slide isn’t flush.">
        <Stack gap={4}>
          <Carousel aria-label="Tight" gap={1}>
            {SLIDES.map((slide) => (
              <Slide key={slide.title} {...slide} />
            ))}
          </Carousel>
          <Carousel aria-label="Roomy" gap={4} padding={4}>
            {SLIDES.map((slide) => (
              <Slide key={slide.title} {...slide} />
            ))}
          </Carousel>
        </Stack>
      </Preview>

      <Preview label="Edge fade, snap, and loop" description="Fade hints there is more; snap lands on a slide; loop wraps from the end back to the start.">
        <Stack gap={4}>
          <Carousel aria-label="Faded" hasEdgeFade>
            {SLIDES.map((slide) => (
              <Slide key={slide.title} {...slide} />
            ))}
          </Carousel>
          <Carousel aria-label="Snapping and looping" hasSnap hasLoop>
            {SLIDES.map((slide) => (
              <Slide key={slide.title} {...slide} />
            ))}
          </Carousel>
        </Stack>
      </Preview>

      <Preview label="Without buttons" description="hasButtons={false} for touch-first rails that scroll by swipe or trackpad.">
        <Carousel aria-label="Swipe only" hasButtons={false} hasEdgeFade>
          {SLIDES.map((slide) => (
            <Slide key={slide.title} {...slide} />
          ))}
        </Carousel>
      </Preview>

      <Preview label="Recommended rooms" description="A rail of room cards — the most common product use.">
        <Stack gap={2}>
          <HStack hAlign="between" vAlign="center">
            <Heading level={4}>Rooms you might like</Heading>
            <Button label="See all" variant="ghost" size="sm" endContent={<Icon icon={icons.arrowRight} />} />
          </HStack>
          <Carousel aria-label="Recommended rooms" gap={3} hasSnap>
            {ROOMS.map((room) => (
              <JobCard key={room.title} title={room.title} meta={room.meta} width={SLIDE_WIDTH} href="#room">
                <Badge label={room.tag} variant={room.variant} />
              </JobCard>
            ))}
          </Carousel>
        </Stack>
      </Preview>

      <Preview label="Testimonials" description="Wide slides with quotes and avatars.">
        <Carousel aria-label="Testimonials" gap={3} hasSnap hasLoop>
          {QUOTES.map(({ quote, person }) => (
            <Card key={person.name} width={WIDE_SLIDE} variant="muted">
              <Stack gap={3}>
                <Blockquote>{quote}</Blockquote>
                <HStack gap={2} vAlign="center">
                  <Avatar name={person.name} size="sm" tooltip={false} />
                  <Stack gap={0}>
                    <Text weight="semibold">{person.name}</Text>
                    <Caption>{person.role}</Caption>
                  </Stack>
                </HStack>
              </Stack>
            </Card>
          ))}
        </Carousel>
      </Preview>

      <Preview label="Attachments" description="Small slides — a thumbnail strip for a bid’s files.">
        <Carousel aria-label="Attachments" gap={2} hasEdgeFade>
          {IMAGES.map((src, index) => (
            <Thumbnail key={index} src={src} label={`attachment-${index + 1}.svg`} alt={`Attachment ${index + 1}`} onClick={() => undefined} />
          ))}
        </Carousel>
      </Preview>

      <Preview label="Guided steps" description="Drive the carousel from outside with handleRef — here, a four-step intro with its own controls.">
        <Stack gap={3}>
          <Carousel aria-label="How OpenSeat works" handleRef={handle} hasButtons={false} hasSnap gap={3}>
            {STEPS.map((s, index) => (
              <Card key={s.title} width={WIDE_SLIDE} variant={index === step ? "blue" : "default"}>
                <Stack gap={2}>
                  <HStack gap={2} vAlign="center">
                    <Icon icon={s.icon} color="accent" />
                    <Text type="supporting" color="secondary">
                      Step {index + 1} of {STEPS.length}
                    </Text>
                  </HStack>
                  <Heading level={4}>{s.title}</Heading>
                  <Text color="secondary">{s.body}</Text>
                </Stack>
              </Card>
            ))}
          </Carousel>
          <HStack gap={2} vAlign="center">
            <IconButton label="Previous step" icon={<Icon icon={icons.chevronLeft} />} isDisabled={step === 0} onClick={() => go(step - 1)} />
            <HStack gap={1}>
              {STEPS.map((s, index) => (
                <Button key={s.title} label={String(index + 1)} size="sm" variant={index === step ? "primary" : "ghost"} onClick={() => go(index)} />
              ))}
            </HStack>
            <IconButton label="Next step" icon={<Icon icon={icons.chevronRight} />} isDisabled={step === STEPS.length - 1} onClick={() => go(step + 1)} />
          </HStack>
        </Stack>
      </Preview>
    </Examples>
  );
}

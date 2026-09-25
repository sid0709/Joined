"use client";

import { Citation, Icon, Link, Stack, Text, icons, type CitationSource } from "@openseat/design-system";
import { Examples, Preview, Row, SAMPLE_IMAGES } from "./shared";

const SOURCES: CitationSource[] = [
  { title: "Astryx", url: "https://astryx.atmeta.com/", src: SAMPLE_IMAGES.globe },
  { title: "React", url: "https://react.dev/" },
  { title: "WCAG 2.2", url: "https://www.w3.org/TR/WCAG22/", icon: <Icon icon={icons.link} /> },
  { title: "Internal pricing memo" },
  { url: "https://nextjs.org/docs" },
];

export default function CitationDemo() {
  return (
    <Examples>
      <Preview align="start" label="Label variant" description="The default: a chip with the source title, an optional icon, and a border.">
        <Row>
          {SOURCES.map((source, index) => (
            <Citation key={index} number={index + 1} source={source} />
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Number variant" description="A compact numbered badge for dense copy.">
        <Row>
          {SOURCES.map((source, index) => (
            <Citation key={index} number={index + 1} source={source} variant="number" />
          ))}
        </Row>
      </Preview>

      <Preview align="start" label="Source icons" description="src takes an image URL; icon takes a node. With neither, the chip is text only.">
        <Row>
          <Citation number={1} source={{ title: "Image source", url: "https://astryx.atmeta.com/", src: SAMPLE_IMAGES.globe }} />
          <Citation number={2} source={{ title: "Icon source", url: "https://react.dev/", icon: <Icon icon={icons.code} /> }} />
          <Citation number={3} source={{ title: "Text only", url: "https://react.dev/" }} />
          <Citation number={4} source={{ title: "No link" }} />
        </Row>
      </Preview>

      <Preview label="In copy — labels" description="Cite right after the claim it supports.">
        <Text display="block">
          Astryx components meet WCAG 2.2 AA
          <Citation number={1} source={SOURCES[2]} /> and render on the server with React 19
          <Citation number={2} source={SOURCES[1]} />.
        </Text>
      </Preview>

      <Preview label="In copy — numbers" description="Numbers keep long paragraphs readable.">
        <Text display="block">
          Sealed rooms reduced average bid spread by a third
          <Citation number={1} source={SOURCES[3]} variant="number" />, while response time stayed flat
          <Citation number={2} source={SOURCES[3]} variant="number" />. The component library is open
          <Citation number={3} source={SOURCES[0]} variant="number" />.
        </Text>
      </Preview>

      <Preview label="With a source list" description="Pair numbered citations with a footnote list at the end.">
        <Stack gap={3}>
          <Text display="block">
            OpenSeat is built on Astryx
            <Citation number={1} source={SOURCES[0]} variant="number" /> and React
            <Citation number={2} source={SOURCES[1]} variant="number" />.
          </Text>
          <Stack gap={1}>
            {SOURCES.slice(0, 2).map((source, index) => (
              <Text key={index} type="supporting" color="secondary" display="block">
                {index + 1}.{" "}
                <Link href={source.url ?? "#"} isExternalLink>
                  {source.title}
                </Link>
              </Text>
            ))}
          </Stack>
        </Stack>
      </Preview>
    </Examples>
  );
}

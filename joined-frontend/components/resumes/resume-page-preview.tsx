import { AspectRatio, Card, Stack } from "sid-ui";

/** US Letter, portrait. */
const PAGE_RATIO = 8.5 / 11;
/** Line widths for a sketched page, as percentages of the column. */
const HEADER_LINES = ["55%", "35%"];
const BODY_BLOCKS = [
  ["30%", "100%", "92%", "96%"],
  ["26%", "100%", "88%"],
  ["22%", "94%", "70%"],
];
const LINE_HEIGHT = 4;
const TITLE_HEIGHT = 8;

function Line({
  width,
  height,
  isHeading = false,
}: {
  width: string;
  height: number;
  isHeading?: boolean;
}) {
  return <Card padding={0} width={width} height={height} variant={isHeading ? "blue" : "gray"} />;
}

/** A sketched first page — a quiet stand-in for a real thumbnail. */
export function ResumePagePreview() {
  return (
    <AspectRatio ratio={PAGE_RATIO}>
      <Card padding={3} elevation="low" height="100%">
        <Stack gap={3}>
          <Stack gap={2}>
            {HEADER_LINES.map((width, index) => (
              <Line key={width} width={width} height={index === 0 ? TITLE_HEIGHT : LINE_HEIGHT} />
            ))}
          </Stack>
          {BODY_BLOCKS.map((block, blockIndex) => (
            <Stack key={blockIndex} gap={1}>
              {block.map((width, lineIndex) => (
                <Line
                  key={`${blockIndex}-${lineIndex}`}
                  width={width}
                  height={LINE_HEIGHT}
                  isHeading={lineIndex === 0}
                />
              ))}
            </Stack>
          ))}
        </Stack>
      </Card>
    </AspectRatio>
  );
}

"use client";

import { Card } from "@astryxdesign/core/Card";
import {
  Layout,
  LayoutContent,
  LayoutFooter,
  LayoutHeader,
  LayoutPanel,
} from "@astryxdesign/core/Layout";
import { Examples, Preview } from "./shared";

export default function LayoutDemo() {
  return (
    <Examples>
      <Preview label="Header, panel, footer">
        <Card height={200} padding={0}>
          <Layout
            height="fill"
            header={<LayoutHeader hasDivider>Header</LayoutHeader>}
            start={<LayoutPanel width={120}>Start</LayoutPanel>}
            content={<LayoutContent>Content</LayoutContent>}
            footer={<LayoutFooter hasDivider>Footer</LayoutFooter>}
          />
        </Card>
      </Preview>
    </Examples>
  );
}

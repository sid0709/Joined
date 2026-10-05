import type { MetadataRoute } from "next";

import { joinedWebUrl } from "@/lib/config";
import { publicRobots } from "@/lib/seo/robots";

export default function robots(): MetadataRoute.Robots {
  return publicRobots(joinedWebUrl());
}

import { API_SERVICES, LOCAL_SERVICES, serviceSite } from "./local-services.mjs";
import { runMany } from "./run-many.mjs";

runMany("Starting every Joined dev server", [
  ...LOCAL_SERVICES.map((service) => ({
    name: service.shortName,
    color: service.color,
    url: serviceSite(service),
    command: "bun",
    args: ["--filter", service.workspace, "dev"],
  })),
  ...API_SERVICES.map((service) => ({
    name: service.shortName,
    color: service.color,
    url: service.url,
    command: service.command,
    args: service.args,
  })),
]);

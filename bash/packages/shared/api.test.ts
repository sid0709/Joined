import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BASH_HOSTS, BASH_SOCKET_PATH, bashHosts } from "./api.ts";

describe("bashHosts", () => {
  it("uses the local servers only for development builds", () => {
    assert.equal(bashHosts("development"), BASH_HOSTS.development);
    assert.equal(bashHosts("production"), BASH_HOSTS.production);
    assert.equal(bashHosts("staging"), BASH_HOSTS.production);
  });

  it("sends production to api.joinedhq.com, with the socket under /bash", () => {
    assert.equal(bashHosts("production").api, "https://api.joinedhq.com");
    assert.ok(BASH_SOCKET_PATH.startsWith("/bash/"));
  });
});

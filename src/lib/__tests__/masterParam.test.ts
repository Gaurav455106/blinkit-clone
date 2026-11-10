import { afterEach, describe, expect, it } from "vitest";
import { readMasterParam } from "../masterAccess";

const visit = (search: string) => window.history.replaceState(null, "", `/login${search}`);

describe("readMasterParam", () => {
  afterEach(() => visit(""));

  it("is null when the address has no ?master", () => {
    visit("");
    expect(readMasterParam()).toBeNull();
  });

  it("asks for the key when ?master has no value", () => {
    visit("?master");
    expect(readMasterParam()).toEqual({ kind: "ask" });
    visit("?master=");
    expect(readMasterParam()).toEqual({ kind: "ask" });
  });

  it("locks the browser with ?master=off", () => {
    visit("?master=off");
    expect(readMasterParam()).toEqual({ kind: "off" });
  });

  it("tries any other value as the key", () => {
    visit("?master=abc123");
    expect(readMasterParam()).toEqual({ kind: "unlock", key: "abc123" });
  });
});

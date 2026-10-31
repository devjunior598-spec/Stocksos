import { describe, expect, it } from "vitest";
import { isDisposableEmail } from "./disposable-email";

describe("disposable email domains", () => {
  it("blocks known temporary domains regardless of case and subdomain", () => {
    expect(isDisposableEmail("Person@MAILINATOR.COM")).toBe(true);
    expect(isDisposableEmail("person@inbox.yopmail.com")).toBe(true);
    expect(isDisposableEmail("person@10minutemail.com")).toBe(true);
  });

  it("allows ordinary domains and names that only contain a blocked suffix", () => {
    expect(isDisposableEmail("person@gmail.com")).toBe(false);
    expect(isDisposableEmail("person@company.com")).toBe(false);
    expect(isDisposableEmail("person@notmailinator.com")).toBe(false);
  });
});

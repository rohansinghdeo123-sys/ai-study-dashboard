import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/onboarding/page.tsx"),
  "utf8",
);

describe("onboarding consent invariants", () => {
  it("does not pre-check required or optional consent", () => {
    expect(source).toContain("const [termsAccepted, setTermsAccepted] = useState(false);");
    expect(source).toContain("const [privacyAccepted, setPrivacyAccepted] = useState(false);");
    expect(source).toContain("const [tipsAccepted, setTipsAccepted] = useState(false);");
  });

  it("requires legal acceptance while keeping tips optional", () => {
    expect(source).toContain("const canCreate = termsAccepted && privacyAccepted;");
    expect(source).toContain("optionalProductTipsAccepted: tipsAccepted");
    expect(source).toContain("Send me occasional learning tips and product updates.");
    expect(source).toContain("optional and does not affect my account.");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Dialog, TabButton, Tabs } from "@/components/ui/primitives";

describe("shared primitive accessibility contracts", () => {
  it("gives every open dialog unique title and description relationships", () => {
    const markup = renderToStaticMarkup(
      <>
        <Dialog open title="First dialog">
          First description
        </Dialog>
        <Dialog open title="Second dialog">
          Second description
        </Dialog>
      </>,
    );

    const titleIds = Array.from(markup.matchAll(/aria-labelledby="([^"]+)"/g), (match) => match[1]);
    const descriptionIds = Array.from(markup.matchAll(/aria-describedby="([^"]+)"/g), (match) => match[1]);

    expect(titleIds).toHaveLength(2);
    expect(descriptionIds).toHaveLength(2);
    expect(new Set(titleIds).size).toBe(2);
    expect(new Set(descriptionIds).size).toBe(2);
    for (const id of [...titleIds, ...descriptionIds]) {
      expect(markup).toContain(`id="${id}"`);
    }
    expect(markup.match(/role="dialog"/g)).toHaveLength(2);
    expect(markup.match(/aria-modal="true"/g)).toHaveLength(2);
  });

  it("renders a single tab stop and stable tab-to-panel relationships", () => {
    const markup = renderToStaticMarkup(
      <Tabs aria-label="Study views">
        <TabButton selected panelId="panel-overview">
          Overview
        </TabButton>
        <TabButton panelId="panel-notes">Notes</TabButton>
      </Tabs>,
    );

    expect(markup).toContain("role=\"tablist\"");
    expect(markup).toContain("aria-orientation=\"horizontal\"");
    expect(markup).toContain("aria-controls=\"panel-overview\"");
    expect(markup).toContain("aria-controls=\"panel-notes\"");
    expect(markup.match(/role="tab"/g)).toHaveLength(2);
    expect(markup.match(/tabindex="0"/g)).toHaveLength(1);
    expect(markup.match(/tabindex="-1"/g)).toHaveLength(1);

    const tabIds = Array.from(markup.matchAll(/id="(ds-tab-[^"]+)"/g), (match) => match[1]);
    expect(tabIds).toHaveLength(2);
    expect(new Set(tabIds).size).toBe(2);
  });
});

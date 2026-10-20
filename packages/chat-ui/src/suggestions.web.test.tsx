import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SuggestionChips } from "./markdown.web";

describe("suggestion chips", () => {
  it("renders one button per idea", () => {
    const html = renderToStaticMarkup(
      <SuggestionChips items={["Plan my week", "Make another bot"]} onPick={() => {}} />,
    );
    expect(html.match(/<button/g)).toHaveLength(2);
    expect(html).toContain("Plan my week");
    expect(html).toContain("Make another bot");
  });
});

import { describe, expect, it } from "vitest";
import {
  getPageObjectContract,
  promotePageObject,
  removePageObjectById,
  replacePageObjectById,
  supportsPageObjectAction,
} from "@/features/editor/lib/pageObjectContract";

describe("pageObjectContract", () => {
  it("keeps transform lifecycle aligned for text and overlay objects", () => {
    expect(supportsPageObjectAction("text", "move")).toBe(true);
    expect(supportsPageObjectAction("text", "resize")).toBe(true);
    expect(supportsPageObjectAction("image", "finishInteraction")).toBe(true);
    expect(supportsPageObjectAction("fileAttachment", "recover")).toBe(true);
    expect(supportsPageObjectAction("shapeNote", "delete")).toBe(true);
  });

  it("allows drawing to participate in the shared persistence lifecycle without fake transform actions", () => {
    const drawingContract = getPageObjectContract("drawing");

    expect(drawingContract.actions.has("commit")).toBe(true);
    expect(drawingContract.actions.has("recover")).toBe(true);
    expect(drawingContract.actions.has("move")).toBe(false);
    expect(drawingContract.actions.has("resize")).toBe(false);
  });

  it("replaces, removes and promotes page objects through common helpers", () => {
    const initialItems = [
      { id: "one", zIndex: 1, title: "before" },
      { id: "two", zIndex: 2, title: "keep" },
    ];

    expect(replacePageObjectById(initialItems, { id: "one", zIndex: 1, title: "after" })).toEqual([
      { id: "one", zIndex: 1, title: "after" },
      { id: "two", zIndex: 2, title: "keep" },
    ]);

    expect(removePageObjectById(initialItems, "one")).toEqual([{ id: "two", zIndex: 2, title: "keep" }]);

    expect(promotePageObject(initialItems, "one", 8)).toEqual({
      items: [
        { id: "one", zIndex: 8, title: "before" },
        { id: "two", zIndex: 2, title: "keep" },
      ],
      promotedItem: { id: "one", zIndex: 8, title: "before" },
    });
  });
});

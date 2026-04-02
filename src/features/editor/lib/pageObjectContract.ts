import { PageElementType } from "@/shared/types/models";

export type PageObjectAction =
  | "select"
  | "activate"
  | "move"
  | "resize"
  | "commit"
  | "discard"
  | "recover"
  | "delete"
  | "finishInteraction";

export interface PageObjectContract {
  type: PageElementType;
  actions: ReadonlySet<PageObjectAction>;
}

export interface PageObjectRecord {
  id: string;
}

export interface PromotablePageObjectRecord extends PageObjectRecord {
  zIndex: number;
}

function createPageObjectContract(type: PageElementType, actions: PageObjectAction[]): PageObjectContract {
  return {
    type,
    actions: new Set(actions),
  };
}

export const PAGE_OBJECT_CONTRACTS: Record<PageElementType, PageObjectContract> = {
  text: createPageObjectContract("text", [
    "select",
    "activate",
    "move",
    "resize",
    "commit",
    "discard",
    "recover",
    "delete",
    "finishInteraction",
  ]),
  image: createPageObjectContract("image", [
    "select",
    "activate",
    "move",
    "resize",
    "commit",
    "discard",
    "recover",
    "delete",
    "finishInteraction",
  ]),
  fileAttachment: createPageObjectContract("fileAttachment", [
    "select",
    "activate",
    "move",
    "resize",
    "commit",
    "discard",
    "recover",
    "delete",
    "finishInteraction",
  ]),
  shapeNote: createPageObjectContract("shapeNote", [
    "select",
    "activate",
    "move",
    "resize",
    "commit",
    "discard",
    "recover",
    "delete",
    "finishInteraction",
  ]),
  drawing: createPageObjectContract("drawing", [
    "activate",
    "commit",
    "discard",
    "recover",
    "delete",
    "finishInteraction",
  ]),
};

export function getPageObjectContract(type: PageElementType) {
  return PAGE_OBJECT_CONTRACTS[type];
}

export function supportsPageObjectAction(type: PageElementType, action: PageObjectAction) {
  return getPageObjectContract(type).actions.has(action);
}

export function replacePageObjectById<T extends PageObjectRecord>(items: T[], nextItem: T) {
  return items.map((item) => (item.id === nextItem.id ? nextItem : item));
}

export function removePageObjectById<T extends PageObjectRecord>(items: T[], targetId: string) {
  return items.filter((item) => item.id !== targetId);
}

export function promotePageObject<T extends PromotablePageObjectRecord>(
  items: T[],
  targetId: string,
  nextZIndex: number,
): { items: T[]; promotedItem: T | null } {
  let promotedItem: T | null = null;

  return {
    items: items.map((item) => {
      if (item.id !== targetId) {
        return item;
      }

      promotedItem = {
        ...item,
        zIndex: nextZIndex,
      };
      return promotedItem;
    }),
    promotedItem,
  };
}

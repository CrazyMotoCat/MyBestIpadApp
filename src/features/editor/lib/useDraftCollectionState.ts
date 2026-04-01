import { Dispatch, MutableRefObject, SetStateAction, useEffect, useRef, useState } from "react";

interface DraftCollectionState<T> {
  items: T[];
  itemsRef: MutableRefObject<T[]>;
  setItems: Dispatch<SetStateAction<T[]>>;
  updateItems: (updater: (current: T[]) => T[]) => void;
}

export function useDraftCollectionState<T>(sourceItems: T[], isLocked: boolean): DraftCollectionState<T> {
  const [items, setItems] = useState(sourceItems);
  const itemsRef = useRef(sourceItems);

  useEffect(() => {
    if (!isLocked) {
      setItems(sourceItems);
      itemsRef.current = sourceItems;
    }
  }, [isLocked, sourceItems]);

  function updateItems(updater: (current: T[]) => T[]) {
    setItems((current) => {
      const nextItems = updater(current);
      itemsRef.current = nextItems;
      return nextItems;
    });
  }

  return {
    items,
    itemsRef,
    setItems,
    updateItems,
  };
}

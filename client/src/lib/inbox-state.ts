/**
 * The few pieces of inbox state that live outside any one component.
 *
 * Layout renders the sidebar outside the dashboard, so the two cannot
 * share props. This tiny store (useSyncExternalStore, no extra
 * dependency) holds the bits they both need: whether triage is on, the
 * search text typed in the header, the list/board switch, and whether
 * the compose window is open.
 */
import { useSyncExternalStore } from "react";

export type InboxView = "list" | "board";

interface InboxState {
  triaged: boolean;
  search: string;
  view: InboxView;
  composeOpen: boolean;
}

const initialState: InboxState = {
  triaged: false,
  search: "",
  view: "list",
  composeOpen: false,
};

let state = initialState;
const listeners = new Set<() => void>();

function setState(partial: Partial<InboxState>) {
  state = { ...state, ...partial };
  listeners.forEach((listener) => listener());
}

export function useInboxState() {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => {
        listeners.delete(onStoreChange);
      };
    },
    () => state,
  );
}

export function setTriaged(triaged: boolean) {
  setState({ triaged });
}

export function setSearch(search: string) {
  setState({ search });
}

export function setInboxView(view: InboxView) {
  setState({ view });
}

export function setComposeOpen(composeOpen: boolean) {
  setState({ composeOpen });
}

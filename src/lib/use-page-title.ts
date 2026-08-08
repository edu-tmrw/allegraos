import { useEffect } from "react";

const BASE_TITLE = "AllegraOS";

/**
 * Sets `document.title` to "AllegraOS — {title}" for as long as the calling
 * page is mounted, restoring the bare "AllegraOS" on unmount — so navigating
 * to a route that doesn't call this itself (there currently isn't one, but a
 * future one might) never leaves a stale title in the tab. Pass no title (the
 * login screen's own case) for the bare app name.
 */
export function usePageTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${BASE_TITLE} — ${title}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}

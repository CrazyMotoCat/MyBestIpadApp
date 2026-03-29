import { Link } from "react-router-dom";
import { Page } from "@/shared/types/models";

interface BookmarksPanelProps {
  notebookId: string;
  currentPageId: string;
  pages: Page[];
}

export function BookmarksPanel({ notebookId, currentPageId, pages }: BookmarksPanelProps) {
  const bookmarked = pages.filter((page) => page.isBookmarked);

  if (bookmarked.length === 0) {
    return <div className="empty-inline">Закладок пока нет.</div>;
  }

  return (
    <div className="stack">
      {bookmarked.map((page) => (
        <Link
          key={page.id}
          className={`bookmark-link ${page.id === currentPageId ? "bookmark-link--active" : ""}`}
          to={`/pages/${page.id}`}
          state={{ notebookId }}
        >
          <span>★</span>
          <span>{page.title}</span>
        </Link>
      ))}
    </div>
  );
}


import { Link } from "react-router-dom";
import { Page } from "@/shared/types/models";

interface BookmarksPanelProps {
  notebookId: string;
  currentPageId: string;
  pages: Page[];
  searchQuery?: string;
}

export function BookmarksPanel({ notebookId, currentPageId, pages, searchQuery = "" }: BookmarksPanelProps) {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const bookmarked = pages.filter((page) => {
    if (!page.isBookmarked) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return page.title.toLowerCase().includes(normalizedQuery);
  });

  if (bookmarked.length === 0) {
    return <div className="empty-inline">{normalizedQuery ? "Поиск по закладкам ничего не нашёл." : "Закладок пока нет."}</div>;
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

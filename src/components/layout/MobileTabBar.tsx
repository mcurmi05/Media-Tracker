import { useLocation, useNavigate } from "react-router-dom";
import { Home, TrendingUp, Bookmark, BookOpen, Plus } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useSearch } from "../../contexts/SearchContext";
import { OPEN_PALETTE_EVENT } from "./CommandPalette";

const leftItems = [
  { title: "Home", url: "/", icon: Home, authOnly: false },
  { title: "Trending", url: "/trending", icon: TrendingUp, authOnly: false },
];

const rightItems = [
  { title: "Watchlist", url: "/watchlist", icon: Bookmark, authOnly: true },
  { title: "Log", url: "/log", icon: BookOpen, authOnly: true },
];

function TabButton({ item }: { item: (typeof leftItems)[number] }) {
  const { isAuthenticated } = useAuth();
  const { clearSearch } = useSearch();
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname === item.url;

  return (
    <button
      type="button"
      data-slot="tab-button"
      onClick={() => {
        clearSearch();
        navigate(item.authOnly && !isAuthenticated ? "/signin" : item.url);
      }}
      className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] ${
        active ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      <item.icon className={`size-5 ${active ? "text-brand" : ""}`} />
      {item.title}
    </button>
  );
}

export default function MobileTabBar() {
  return (
    <nav
      data-slot="mobile-tab-bar"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="flex items-center">
        {leftItems.map((item) => (
          <TabButton key={item.url} item={item} />
        ))}
        <div className="flex flex-1 justify-center">
          <button
            type="button"
            data-slot="tab-add"
            aria-label="Add"
            onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
            className="-mt-4 flex size-12 items-center justify-center rounded-full bg-brand text-white shadow-lg active:scale-95"
          >
            <Plus className="size-6" />
          </button>
        </div>
        {rightItems.map((item) => (
          <TabButton key={item.url} item={item} />
        ))}
      </div>
    </nav>
  );
}

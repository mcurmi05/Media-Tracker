import SearchBar from "../search/SearchBar";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur">
      <SidebarTrigger className="text-muted-foreground" />
      <div className="flex flex-1 justify-center">
        <SearchBar />
      </div>
      {/* spacer mirrors the trigger so the search bar stays centered */}
      <div className="size-7 shrink-0" />
    </header>
  );
}

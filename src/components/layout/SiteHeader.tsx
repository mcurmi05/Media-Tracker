import { Plus } from "lucide-react";
import SearchBar from "../search/SearchBar";
import CommandPalette, { OPEN_PALETTE_EVENT } from "./CommandPalette";
import { SidebarTrigger } from "@/components/ui/sidebar";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur">
      <SidebarTrigger className="text-muted-foreground" />
      <div className="flex flex-1 justify-center">
        <SearchBar />
      </div>
      {/* same size as the trigger so the search bar stays centered */}
      <button
        type="button"
        data-slot="header-add"
        aria-label="Add or search"
        onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
        className="hidden size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:flex"
      >
        <Plus className="size-4" />
      </button>
      <CommandPalette />
    </header>
  );
}

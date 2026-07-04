import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  TrendingUp,
  Bookmark,
  List,
  BookOpen,
  Star,
  Settings,
  LogOut,
  LogIn,
  Clapperboard,
  ChevronsUpDown,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useSearch } from "../../contexts/SearchContext";
import { getAvatarUrl, getDisplayName } from "../../utils/profile";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const discoverItems = [
  { title: "Home", url: "/", icon: Home, authOnly: false },
  { title: "Trending", url: "/trending", icon: TrendingUp, authOnly: false },
];

const libraryItems = [
  { title: "Watchlist", url: "/watchlist", icon: Bookmark, authOnly: true },
  { title: "Lists", url: "/lists", icon: List, authOnly: true },
  { title: "Log", url: "/log", icon: BookOpen, authOnly: true },
  { title: "Ratings", url: "/ratings", icon: Star, authOnly: true },
];

function NavGroup({
  label,
  items,
}: {
  label: string;
  items: typeof discoverItems;
}) {
  const { clearSearch } = useSearch();
  const { isAuthenticated } = useAuth();
  const { setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = (item: (typeof items)[number]) => {
    clearSearch();
    setOpenMobile(false);
    if (item.authOnly && !isAuthenticated) {
      navigate("/signin");
      return;
    }
    navigate(item.url);
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={location.pathname === item.url}
                onClick={() => handleClick(item)}
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function UserFooter() {
  const { isAuthenticated, user, signOut } = useAuth();
  const { clearSearch } = useSearch();
  const { setOpenMobile } = useSidebar();
  const navigate = useNavigate();

  const go = (path: string) => {
    clearSearch();
    setOpenMobile(false);
    navigate(path);
  };

  const handleSignOut = async () => {
    go("/");
    await signOut();
  };

  if (!isAuthenticated) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="Sign In" onClick={() => go("/signin")}>
            <LogIn />
            <span>Sign In</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  const name = getDisplayName(user);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={name}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarImage src={getAvatarUrl(user)} alt={name} />
                <AvatarFallback className="rounded-lg">
                  {name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user?.email}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side="top"
            align="start"
            sideOffset={4}
          >
            <DropdownMenuItem onClick={() => go("/account")}>
              <Settings />
              Account Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export default function AppSidebar() {
  const { clearSearch } = useSearch();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Media Tracker">
              <Link
                to="/"
                onClick={() => {
                  clearSearch();
                  setOpenMobile(false);
                }}
              >
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-brand text-white">
                  <Clapperboard className="size-4" />
                </div>
                <span className="truncate font-semibold">Media Tracker</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavGroup label="Discover" items={discoverItems} />
        <NavGroup label="Library" items={libraryItems} />
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Source repo">
              <a
                href="https://github.com/mcurmi05/Movie-Library"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img src="/images/github.png" alt="" className="size-4" />
                <span>Source repo</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <UserFooter />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

import "./styles/layout/App.css";
import Search from "./pages/Search";
import Trending from "./pages/Trending";
import AppSidebar from "./components/layout/AppSidebar";
import SiteHeader from "./components/layout/SiteHeader";
import MobileTabBar from "./components/layout/MobileTabBar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SearchProvider } from "./contexts/SearchContext";
import { PopularMoviesCacheProvider } from "./contexts/PopularMoviesCacheContext";
import { ImdbRatingsProvider } from "./contexts/ImdbRatingsContext";
import { LetterboxdRatingsProvider } from "./contexts/LetterboxdRatingsContext";
import { GoodreadsRatingsProvider } from "./contexts/GoodreadsRatingsContext";
import { StorygraphRatingsProvider } from "./features/ratings/storygraph/StorygraphRatingsContext";
import { Routes, Route, useLocation } from "react-router-dom";
import MediaDetails from "./pages/MediaDetails";
import BookDetails from "./pages/BookDetails";
import { SignIn } from "./pages/SignIn";
import { supabase } from "./services/supabase-client";
import { useState, useEffect } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import { UserRatingsProvider } from "./contexts/UserRatingsContext";
import Ratings from "./pages/Ratings";
import Log from "./pages/Log";
import { UserLogsProvider } from "./contexts/UserLogsContext";
import Home from "./pages/Home";
import { UserWatchlistProvider } from "./contexts/UserWatchlistContext";
import { UserBookLogsProvider } from "./contexts/UserBookLogsContext";
import { UserBookTbrProvider } from "./contexts/UserBookTbrContext";
import { UserBookRatingsProvider } from "./contexts/UserBookRatingsContext";
import { UserCoversProvider } from "./contexts/UserCoversContext";
import Watchlist from "./pages/Watchlist";
import AccountSettings from "./pages/AccountSettings";
import Lists from "./pages/Lists";
import ListView from "./pages/ListView";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function App() {
  const [session, setSession] = useState(null);

  const fetchSession = async () => {
    const currentSession = await supabase.auth.getSession();
    console.log("Current user session:", currentSession);
    setSession(currentSession.data.session);
  };

  useEffect(() => {
    fetchSession();
  }, []);

  return (
    <div className="app-shell">
      <AuthProvider>
        <SearchProvider>
          <PopularMoviesCacheProvider>
            <ImdbRatingsProvider>
            <LetterboxdRatingsProvider>
            <GoodreadsRatingsProvider>
            <StorygraphRatingsProvider>
            <UserRatingsProvider>
              <UserLogsProvider>
                <UserWatchlistProvider>
                  <UserBookLogsProvider>
                    <UserBookTbrProvider>
                      <UserBookRatingsProvider>
                    <UserCoversProvider>
                    <ScrollToTop />
                    <SidebarProvider>
                      <AppSidebar />
                      <SidebarInset className="bg-transparent">
                        <SiteHeader />
                        <main className="main-content">
                          <Routes>
                        <Route path="/" element={<Home></Home>}></Route>
                        <Route
                          path="/trending"
                          element={<Trending></Trending>}
                        ></Route>
                        <Route
                          path="/search"
                          element={<Search></Search>}
                        ></Route>
                        <Route
                          path="/mediadetails/:mediaType/:tmdbId"
                          element={<MediaDetails></MediaDetails>}
                        />
                        <Route
                          path="/bookdetails/hardcover/:hardcoverId"
                          element={<BookDetails />}
                        />
                        <Route
                          path="/bookdetails/*"
                          element={<BookDetails></BookDetails>}
                        />
                        <Route path="/signin" element={<SignIn></SignIn>} />
                        <Route path="/ratings" element={<Ratings></Ratings>} />
                        <Route path="/log" element={<Log></Log>} />
                        <Route
                          path="/watchlist"
                          element={<Watchlist></Watchlist>}
                        />
                        <Route
                          path="/account"
                          element={<AccountSettings></AccountSettings>}
                        />
                          <Route path="/lists" element={<Lists />} />
                          <Route path="/lists/:id" element={<ListView />} />
                          </Routes>
                        </main>
                        <MobileTabBar />
                      </SidebarInset>
                    </SidebarProvider>
                    </UserCoversProvider>
                      </UserBookRatingsProvider>
                    </UserBookTbrProvider>
                  </UserBookLogsProvider>
                </UserWatchlistProvider>
              </UserLogsProvider>
            </UserRatingsProvider>
            </StorygraphRatingsProvider>
            </GoodreadsRatingsProvider>
            </LetterboxdRatingsProvider>
            </ImdbRatingsProvider>
          </PopularMoviesCacheProvider>
        </SearchProvider>
      </AuthProvider>
    </div>
  );
}

export default App;

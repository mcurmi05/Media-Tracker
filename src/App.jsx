import "./styles/App.css";
import Search from "./pages/Search.jsx";
import Trending from "./pages/Trending.jsx";
import NavBar from "./components/NavBar.jsx";
import { SearchProvider } from "./contexts/SearchContext";
import { PopularMoviesCacheProvider } from "./contexts/PopularMoviesCacheContext.jsx";
import { Routes, Route } from "react-router-dom";
import MediaDetails from "./pages/MediaDetails.jsx";
import { SignIn } from "./pages/SignIn.jsx";
import { supabase } from "./services/supabase-client.js";
import { useState, useEffect } from "react";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { UserRatingsProvider } from "./contexts/UserRatingsContext.jsx";
import Ratings from "./pages/Ratings.jsx";
import Log from "./pages/Log.jsx";
import { UserLogsProvider } from "./contexts/UserLogsContext.jsx";
import Home from "./pages/Home.jsx";
import { UserWatchlistProvider } from "./contexts/UserWatchlistContext.jsx";
import { UserBookLogsProvider } from "./contexts/UserBookLogsContext.jsx";
import { UserBookTbrProvider } from "./contexts/UserBookTbrContext.jsx";
import Watchlist from "./pages/Watchlist.jsx";

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
    <div>
      <AuthProvider>
        <SearchProvider>
          <PopularMoviesCacheProvider>
            <UserRatingsProvider>
              <UserLogsProvider>
                <UserWatchlistProvider>
                  <UserBookLogsProvider>
                    <UserBookTbrProvider>
                    <NavBar />
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
                          path="/mediadetails/:id"
                          element={<MediaDetails></MediaDetails>}
                        />
                        <Route path="/signin" element={<SignIn></SignIn>} />
                        <Route path="/ratings" element={<Ratings></Ratings>} />
                        <Route path="/log" element={<Log></Log>} />
                        <Route
                          path="/watchlist"
                          element={<Watchlist></Watchlist>}
                        />
                      </Routes>
                    </main>
                    </UserBookTbrProvider>
                  </UserBookLogsProvider>
                </UserWatchlistProvider>
              </UserLogsProvider>
            </UserRatingsProvider>
          </PopularMoviesCacheProvider>
        </SearchProvider>
      </AuthProvider>
    </div>
  );
}

export default App;

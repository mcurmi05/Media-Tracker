import { Link, useNavigate } from "react-router-dom";
import { useSearch } from "../contexts/SearchContext";
import { useAuth } from "../contexts/AuthContext";
import SearchBar from "./SearchBar";
import { useState, useEffect, useRef } from "react";
import "../styles/NavBar.css";

function NavBar() {
  const { clearSearch } = useSearch();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const burgerMenuRef = useRef(null);
  const profileMenuRef = useRef(null);

  const { isAuthenticated, user, signOut, loading } = useAuth();
  const navigate = useNavigate();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleLinkClick = () => {
    clearSearch();
    setIsMenuOpen(false);
  };

  const handleSignOut = async () => {
    navigate("/")
    await signOut();
    clearSearch();
    setIsMenuOpen(false);
    setIsProfileMenuOpen(false);
  };

  const handleAuthOnlyRouteClick = (route) => {
    clearSearch();
    setIsMenuOpen(false);

    if (isAuthenticated) {
      navigate(route);
    } else {
      navigate("/signin");
      window.location.reload();    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        burgerMenuRef.current &&
        !burgerMenuRef.current.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target)
      ) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getAvatarUrl = (email) => {
    if (!email) return "/placeholderimage.jpg";
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      email
    )}&background=random`;
  };

  if (loading) {
    return <nav className="navbar">Loading...</nav>;
  }

  return (
    <nav className="navbar">
      <div className="home-and-gh">
        <Link to="/" className="nav-link home-button" onClick={clearSearch}>
          <img className="nav-icon" src="/home.png" alt="Home"></img>
        </Link>
        <a
          href="https://github.com/mcurmi05/Media-Library"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-link home-button github"
        >
          <img src="/github.png" className="nav-icon" />
        </a>
        
      </div>
      <SearchBar></SearchBar>

      <div
        className="burger-menu-container navbar-icon-div nav-link"
        ref={burgerMenuRef}
      >
        <img
          className="nav-icon"
          src="/burgermenu.png"
          onClick={toggleMenu}
          alt="Menu"
        ></img>

        {isMenuOpen && (
          <div className="burger-dropdown">
            <Link to="/" className="dropdown-nav-item" onClick={handleLinkClick}>
              <div className="navbar-icon-div">
                <img className="nav-icon" src="/home.png"></img>
                <p className="names-to-links">Home</p>
              </div>
            </Link>

            <Link
              to="/trending"
              className="dropdown-nav-item"
              onClick={handleLinkClick}
            >
              <div className="navbar-icon-div">
                <img className="nav-icon" src="/trending.png"></img>
                <p className="names-to-links">Trending</p>
              </div>
            </Link>

            <a
              to="/ratings"
              className="dropdown-nav-item"
              onClick={() => handleAuthOnlyRouteClick("/ratings")}
            >
              <div className="navbar-icon-div">
                <img className="nav-icon" src="/ratings.png"></img>
                <p className="names-to-links">Ratings</p>
              </div>
            </a>

            <a
              to="/watchlist"
              className="dropdown-nav-item"
              onClick={() => handleAuthOnlyRouteClick("/watchlist")}
            >
              <div className="navbar-icon-div">
                <img className="nav-icon" src="/watchlist-navbar.png"></img>
                <p className="names-to-links">Watchlist</p>
              </div>
            </a>

            <a
              to="/log"
              className="dropdown-nav-item"
              onClick={() => handleAuthOnlyRouteClick("/log")}
            >
              <div className="navbar-icon-div">
                <img className="nav-icon" src="/log.png"></img>
                <p className="names-to-links">Log</p>
              </div>
            </a>

            <a
              href="https://github.com/mcurmi05/Media-Library"
              target="_blank"
              rel="noopener noreferrer"
              className="dropdown-nav-item "
            >
              <div className="navbar-icon-div">
                <img src="/github.png" className="nav-icon github-icon" />
                <p className="names-to-links">Source repo</p>
              </div>
              
            </a>

            {isAuthenticated ? (
              <div className="user-avatar-container">
                <img
                  className="user-avatar"
                  src={getAvatarUrl(user?.email)}
                  onClick={handleSignOut}
                />
              </div>
            ) : (
              <Link
                to="/signin"
                className="dropdown-nav-item"
                onClick={handleLinkClick}
              >
                <div className="navbar-icon-div">
                  <img className="nav-icon" src="/signin.png"></img>
                  <p className="names-to-links">Sign In</p>
                </div>
              </Link>
            )}

            
          </div>
        )}
      </div>

      <div className="navbar-links">
        <Link to="/trending" className="nav-link" onClick={clearSearch}>
          <div className="navbar-icon-div">
            <img className="nav-icon" src="/trending.png"></img>
            <p className="names-to-links">Trending</p>
          </div>
        </Link>

        <a
          to="/ratings"
          className="nav-link"
          onClick={() => handleAuthOnlyRouteClick("/ratings")}
        >
          <div className="navbar-icon-div">
            <img className="nav-icon" src="/ratings.png"></img>
            <p className="names-to-links">Ratings</p>
          </div>
        </a>

        <a
          to="/watchlist"
          className="nav-link"
          onClick={() => handleAuthOnlyRouteClick("/watchlist")}
        >
          <div className="navbar-icon-div">
            <img className="nav-icon" src="/watchlist-navbar.png"></img>
            <p className="names-to-links">Watchlist</p>
          </div>
        </a>

        <a
          to="/log"
          className="nav-link"
          onClick={() => handleAuthOnlyRouteClick("/log")}
        >
          <div className="navbar-icon-div">
            <img className="nav-icon" src="/log.png"></img>
            <p className="names-to-links">Log</p>
          </div>
        </a>

        {isAuthenticated ? (
          <div className="user-avatar-container" ref={profileMenuRef}>
            <img
              className="user-avatar"
              src={getAvatarUrl(user?.email)}
              onClick={() => setIsProfileMenuOpen((open) => !open)}
            />
            {isProfileMenuOpen && (
              <div className="profile-dropdown">
                <div
                  className="dropdown-nav-item"
                  onClick={handleSignOut}
                >
                  <div className="navbar-icon-div">
                    <img className="nav-icon" src="/signin.png" alt="" />
                    <p className="names-to-links">Sign Out</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link to="/signin" className="nav-link" onClick={clearSearch}>
            <div className="navbar-icon-div">
              <img className="nav-icon" src="/signin.png"></img>
              <p className="names-to-links">Sign In</p>
            </div>
          </Link>
        )}
      </div>
    </nav>
  );
}

export default NavBar;

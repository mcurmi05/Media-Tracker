import { createContext, useContext, useState } from 'react';
/* eslint-disable react-refresh/only-export-components */

const PopularMoviesCacheContext = createContext();

export const useCache = () => {
  const context = useContext(PopularMoviesCacheContext);
  if (!context) {
    throw new Error('useCache must be used within a CacheProvider');
  }
  return context;
};

export const PopularMoviesCacheProvider = ({ children }) => {
  const [popularMovies, setPopularMovies] = useState(null);
  const [popularMoviesLoaded, setPopularMoviesLoaded] = useState(false);
  const [popularTV, setPopularTV] = useState(null);
  const [popularTVLoaded, setPopularTVLoaded] = useState(false);

  const cachePopularMovies = (movies) => {
    setPopularMovies(movies);
    setPopularMoviesLoaded(true);
  };

  const cachePopularTV = (tv) => {
    setPopularTV(tv);
    setPopularTVLoaded(true);
  };

  return (
    <PopularMoviesCacheContext.Provider value={{
      popularMovies,
      popularMoviesLoaded,
      cachePopularMovies,
      popularTV,
      popularTVLoaded,
      cachePopularTV,
    }}>
      {children}
    </PopularMoviesCacheContext.Provider>
  );
};
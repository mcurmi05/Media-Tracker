import { createContext, useContext, useState } from 'react';
/* eslint-disable react-refresh/only-export-components */

const SearchContext = createContext();

export const useSearch = () => {
  const context = useContext(SearchContext);
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider');
  }
  return context;
};

export const SearchProvider = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchError, setSearchError] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMode, setSearchMode] = useState("movies");


  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults(null);
    setSearchError(null);
  };

  return (
    <SearchContext.Provider value={{
      searchQuery,
      setSearchQuery,
      searchResults,
      setSearchResults,
      searchError,
      setSearchError,
      searchLoading,
      setSearchLoading,
      searchMode,
      setSearchMode,
      clearSearch
    }}>
      {children}
    </SearchContext.Provider>
  );
};
import { useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { SearchResult } from "@shared/schema";

interface SearchBarProps {
  searchQuery: string;
  searchResults: SearchResult[];
  showResults: boolean;
  handleSearchInput: (query: string) => void;
  clearSearch: () => void;
  selectResult: (result: SearchResult) => void;
}

export default function SearchBar({
  searchQuery,
  searchResults,
  showResults,
  handleSearchInput,
  clearSearch,
  selectResult,
}: SearchBarProps) {
  const searchResultsRef = useRef<HTMLDivElement>(null);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchResultsRef.current &&
        !searchResultsRef.current.contains(event.target as Node)
      ) {
        // Don't hide if the click was on the input
        const isInputClick = (event.target as HTMLElement).closest('input');
        if (!isInputClick) {
          // Only close search results, not clear the input
          searchResultsRef.current.classList.add('hidden');
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative mb-5">
      <div className="relative">
        <Input
          type="text"
          placeholder="장소를 검색해주세요"
          className="w-full py-2.5 pl-10 pr-4 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-map-blue focus:border-transparent"
          value={searchQuery}
          onChange={(e) => handleSearchInput(e.target.value)}
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-gray-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        {searchQuery && (
          <button
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            onClick={clearSearch}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-gray-400 hover:text-gray-600"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Search Results */}
      <div
        ref={searchResultsRef}
        className={`search-results ${
          showResults ? "" : "hidden"
        } absolute z-10 mt-1 w-full bg-white rounded-md shadow-lg max-h-60 overflow-auto`}
      >
        {searchResults.map((result) => (
          <div
            key={result.id}
            className="px-4 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100"
            onClick={() => selectResult(result)}
          >
            <div className="font-medium">{result.name}</div>
            <div className="text-sm text-gray-500">{result.address}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

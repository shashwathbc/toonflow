import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type FontSize = 'sm' | 'md' | 'lg' | 'xl'
type SortBy = 'trending' | 'newest' | 'rating'
type ContentType = 'all' | 'novel' | 'webtoon'

interface BrowseFilters {
  genre: string | null
  status: string | null
  sortBy: SortBy
  contentType: ContentType
}

const DEFAULT_BROWSE_FILTERS: BrowseFilters = {
  genre: null,
  status: null,
  sortBy: 'trending',
  contentType: 'all',
}

interface AppStore {
  fontSize: FontSize
  setFontSize: (size: FontSize) => void

  browseFilters: BrowseFilters
  setBrowseFilters: (filters: Partial<BrowseFilters>) => void
  resetBrowseFilters: () => void

  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void

  searchQuery: string
  setSearchQuery: (q: string) => void

  loginModalOpen: boolean
  setLoginModalOpen: (open: boolean) => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      fontSize: 'md',
      setFontSize: (fontSize) => set({ fontSize }),

      browseFilters: DEFAULT_BROWSE_FILTERS,
      setBrowseFilters: (filters) =>
        set((state) => ({
          browseFilters: { ...state.browseFilters, ...filters },
        })),
      resetBrowseFilters: () => set({ browseFilters: DEFAULT_BROWSE_FILTERS }),

      mobileNavOpen: false,
      setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),

      searchQuery: '',
      setSearchQuery: (searchQuery) => set({ searchQuery }),

      loginModalOpen: false,
      setLoginModalOpen: (loginModalOpen) => set({ loginModalOpen }),
    }),
    {
      name: 'toonflow-prefs',
      partialize: (state) => ({
        fontSize: state.fontSize,
        browseFilters: state.browseFilters,
      }),
    }
  )
)

import { create } from 'zustand';

interface AppState {
  shopName: string;
  setShopName: (name: string) => void;
  driveAccessToken: string | null;
  setDriveAccessToken: (token: string | null) => void;
  isLoggedIn: boolean;
  setIsLoggedIn: (val: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  shopName: 'My Shop',
  setShopName: (name) => set({ shopName: name }),
  driveAccessToken: null,
  setDriveAccessToken: (token) => set({ driveAccessToken: token }),
  isLoggedIn: false,
  setIsLoggedIn: (val) => set({ isLoggedIn: val }),
}));

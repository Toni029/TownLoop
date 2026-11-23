import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
const key = "selected_community";
const activeCommunity = "cecil_pines";
const Context = createContext<{
  community: string | null;
  ready: boolean;
  selectCommunity: (id: string) => Promise<void>;
  clearCommunity: () => Promise<void>;
}>({
  community: null,
  ready: false,
  selectCommunity: async () => {},
  clearCommunity: async () => {},
});
export function CommunityProvider({ children }: PropsWithChildren) {
  const [community, setCommunity] = useState<string | null>(null),
    [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(key)
      .then((value) => {
        if (active) setCommunity(value === activeCommunity || value === "upcoming_community" ? activeCommunity : null);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  async function selectCommunity(id: string) {
    if (id !== activeCommunity) throw Error("Please select a valid community.");
    await AsyncStorage.setItem(key, id);
    setCommunity(id);
  }
  async function clearCommunity() {
    await AsyncStorage.removeItem(key);
    setCommunity(null);
  }
  return (
    <Context.Provider
      value={{ community, ready, selectCommunity, clearCommunity }}
    >
      {children}
    </Context.Provider>
  );
}
export const useCommunity = () => useContext(Context);

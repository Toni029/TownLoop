import { canViewAllWorkOrders } from "../../../src/utils/permissions";
import { subscribeSafely } from "./subscription";
import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import { friendlyError } from "./profile";
import { useResident } from "./resident";
export function useLiveCollection<T>(
  name: string,
  read: (id: string, data: Record<string, any>) => T,
  sortField = "createdAt",
) {
  const user = useResident();
  const uid = user ? String(user.id) : "";
  const residentOrders = name === "work_orders" && !!user && !canViewAllWorkOrders(user);
  const [attempt, setAttempt] = useState(0);
  const key =
    user && user.approved !== false
      ? `${user.id}:${user.role}:${residentOrders}:${name}:${attempt}`
      : "";
  const [owned, setOwned] = useState<{
    key: string;
    items: T[];
    loading: boolean;
    error: string;
  }>({ key: "", items: [], loading: true, error: "" });
  useEffect(() => {
    if (!key) return;
    const source = residentOrders
      ? query(collection(db, name), where("userId", "==", uid))
      : sortField
        ? query(collection(db, name), orderBy(sortField, "desc"))
        : collection(db, name);
    return subscribeSafely(
      (next, fail) =>
        onSnapshot(
          source,
          (snapshot) =>
            next(
              (residentOrders
                ? [...snapshot.docs].sort(
                    (a, b) =>
                      (b.data().createdAt?.toMillis?.() || 0) -
                      (a.data().createdAt?.toMillis?.() || 0),
                  )
                : snapshot.docs
              ).map((d) => read(d.id, d.data())),
            ),
          fail,
        ),
      (items: T[]) => setOwned({ key, items, loading: false, error: "" }),
      (error) =>
        setOwned((state) => ({
          key,
          items: state.key === key ? state.items : [],
          loading: false,
          error: friendlyError(error),
        })),
    );
  }, [key, name, read, sortField, attempt, uid, residentOrders]);
  return {
    ...(key && owned.key === key
      ? owned
      : { items: [] as T[], loading: !!key, error: "" }),
    retry: () => setAttempt((n) => n + 1),
  };
}

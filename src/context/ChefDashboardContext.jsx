import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  chefCreateMenu,
  chefLockBatch,
  chefMarkPacked,
  chefPatchKitchen,
  chefPatchMenuItem,
  chefPauseKitchen,
  chefSetAccepting,
  chefToggleStock,
  fetchChefDashboard,
  respondDietaryRequest,
} from "../services/api";
import { getActiveMealWindow } from "../lib/mealWindow";
import { buildCookSummary } from "../lib/chefDashboard";

const ChefDashboardContext = createContext(null);

const EMPTY_KITCHEN = {
  kitchenName: "",
  chefName: "",
  address: "",
  hometownRegion: "",
  dailyCapacity: 0,
  fssaiLicenseNumber: "",
};

export function ChefDashboardProvider({ children, token }) {
  const fallbackWindow = getActiveMealWindow();
  const [snapshot, setSnapshot] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [pollError, setPollError] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [mutating, setMutating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!token) {
      setSnapshot(null);
      setLoading(false);
      return;
    }
    const data = await fetchChefDashboard(token);
    if (!mounted.current) return;
    setSnapshot(data);
    setLastUpdated(new Date());
    setPollError(null);
  }, [token]);

  useEffect(() => {
    setLoading(Boolean(token));
    setPollError(null);
    refresh().catch((err) => {
      if (!mounted.current) return;
      setPollError(err.message);
      setError(err.message);
    }).finally(() => {
      if (mounted.current) setLoading(false);
    });
    const id = setInterval(() => {
      refresh().catch((err) => {
        if (mounted.current) setPollError(err.message);
      });
    }, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  const kitchen = snapshot?.kitchen || EMPTY_KITCHEN;
  const windowInfo = snapshot?.windowInfo
    ? {
        mealWindow: snapshot.windowInfo.mealWindow,
        cutoffTime: snapshot.windowInfo.cutoffTime,
        label: snapshot.windowInfo.label,
      }
    : fallbackWindow;
  const orders = snapshot?.orders || [];
  const menuItems = snapshot?.menuItems || [];
  const reels = snapshot?.reels || [];
  const dietaryRequests = snapshot?.dietaryRequests || [];
  const cook = snapshot?.cook || buildCookSummary(orders, windowInfo.mealWindow || windowInfo.meal_window);
  const remainingCapacity = snapshot?.remainingCapacity ?? 0;
  const committedMeals = snapshot?.committedMeals ?? 0;
  const kitchenState = snapshot?.kitchenState || "KITCHEN_CLOSED";
  const isPackedReady = Boolean(snapshot?.isPackedReady);
  const earnings = snapshot?.earnings || {
    todayIncome: 0,
    weeklyPayout: 0,
    completedOrders: 0,
    repeatRetentionPct: 0,
  };
  const rider = snapshot?.rider || { riderName: "Unassigned", vehicleNumber: "—" };

  const run = useCallback(
    async (fn, okMessage) => {
      setError(null);
      setMutating(true);
      try {
        await fn();
        await refresh();
        if (okMessage) setNotice(okMessage);
      } catch (err) {
        setError(err.message);
        setNotice(err.message);
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [refresh]
  );

  const toggleAccepting = useCallback(() => {
    const next = kitchenState !== "ACCEPTING_ORDERS";
    return run(() => chefSetAccepting(next, token), next ? "Kitchen is accepting orders." : "Kitchen stopped accepting orders.");
  }, [kitchenState, run, token]);
  const pauseKitchen = useCallback(() => run(() => chefPauseKitchen(token), "Kitchen paused."), [run, token]);
  const markPacked = useCallback(() => run(() => chefMarkPacked(token), "Batch marked packed."), [run, token]);
  const lockBatch = useCallback(() => run(() => chefLockBatch(token), "Cutoff batch locked."), [run, token]);
  const createMenuItem = useCallback(
    async (item) => {
      await run(
        () =>
          chefCreateMenu(
            {
              dish_name: item.itemName,
              description: item.description,
              unit_price: Number(item.unitPrice),
              meal_type: item.mealWindow || "LUNCH",
              is_available: true,
            },
            token
          ),
        "Dish added to menu."
      );
    },
    [run, token]
  );
  const updateMenuItem = useCallback(
    (menuItemId, item) =>
      run(
        () =>
          chefPatchMenuItem(
            menuItemId,
            {
              ...(item.itemName != null ? { dish_name: item.itemName } : {}),
              ...(item.description != null ? { description: item.description } : {}),
              ...(item.unitPrice != null ? { unit_price: Number(item.unitPrice) } : {}),
              ...(item.mealWindow != null ? { meal_type: item.mealWindow } : {}),
              ...(item.availability != null ? { is_available: item.availability === "IN_STOCK" } : {}),
            },
            token
          ),
        "Dish updated."
      ),
    [run, token]
  );
  const toggleAvailability = useCallback(
    (menuItemId) => run(() => chefToggleStock(menuItemId, token), "Availability updated."),
    [run, token]
  );
  const setKitchen = useCallback(
    (next) =>
      run(
        () =>
          chefPatchKitchen(
            {
              kitchen_name: next.kitchenName,
              chef_name: next.chefName,
              address: next.address,
              hometown_region: next.hometownRegion,
              daily_capacity: Number(next.dailyCapacity),
            },
            token
          ),
        "Kitchen profile saved."
      ),
    [run, token]
  );

  const respondDietary = useCallback(
    (requestId, action, counterOffer) =>
      run(
        () =>
          respondDietaryRequest(
            requestId,
            {
              action,
              ...(action === "counter" ? { counter_offer: counterOffer } : {}),
            },
            token
          ),
        action === "accept"
          ? "Request accepted."
          : action === "reject"
            ? "Request rejected."
            : "Counter-offer sent."
      ),
    [run, token]
  );
  const acceptDietary = useCallback((requestId) => respondDietary(requestId, "accept"), [respondDietary]);
  const rejectDietary = useCallback((requestId) => respondDietary(requestId, "reject"), [respondDietary]);
  const counterDietary = useCallback(
    (requestId, counterOffer) => respondDietary(requestId, "counter", counterOffer),
    [respondDietary]
  );
  const addReel = useCallback(() => refresh(), [refresh]);

  const cluster = useMemo(() => {
    const city = snapshot?.kitchen?.city || snapshot?.kitchen?.address;
    if (!city) return null;
    return String(city).split(",")[0].trim() || null;
  }, [snapshot]);

  const value = useMemo(
    () => ({
      kitchen,
      setKitchen,
      acceptingOrders: kitchenState === "ACCEPTING_ORDERS",
      toggleAccepting,
      pauseKitchen,
      kitchenState,
      remainingCapacity,
      committedMeals,
      capacityReached: remainingCapacity <= 0,
      windowInfo,
      cook,
      isPackedReady,
      markPacked,
      lockBatch,
      menuItems,
      createMenuItem,
      updateMenuItem,
      toggleAvailability,
      orders,
      rider,
      dietaryRequests,
      acceptDietary,
      rejectDietary,
      counterDietary,
      reels,
      addReel,
      earnings,
      cluster,
      loading,
      mutating,
      lastUpdated,
      pollError,
      notice: notice || error || (token ? null : "Sign in under More to load this kitchen."),
      refresh,
    }),
    [
      kitchen,
      setKitchen,
      kitchenState,
      toggleAccepting,
      pauseKitchen,
      remainingCapacity,
      committedMeals,
      windowInfo,
      cook,
      isPackedReady,
      markPacked,
      lockBatch,
      menuItems,
      createMenuItem,
      updateMenuItem,
      toggleAvailability,
      orders,
      rider,
      dietaryRequests,
      acceptDietary,
      rejectDietary,
      counterDietary,
      reels,
      addReel,
      earnings,
      cluster,
      loading,
      mutating,
      lastUpdated,
      pollError,
      notice,
      error,
      refresh,
      token,
    ]
  );

  return <ChefDashboardContext.Provider value={value}>{children}</ChefDashboardContext.Provider>;
}

export function useChefDashboard() {
  const context = useContext(ChefDashboardContext);
  if (!context) throw new Error("useChefDashboard must be used within ChefDashboardContext");
  return context;
}

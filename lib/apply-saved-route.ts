import { useCustomerStore } from "@/store/customer-store";
import type { SavedRoute } from "@/types/saved-route";
import type { RouteStopKey } from "@/types/route-plan";

/**
 * Apply a saved route snapshot to the live route selection (customers,
 * extra stops, visit order, starting point).
 * Returns false if the user cancelled the replace confirmation.
 */
export function applySavedRouteToStore(route: SavedRoute): boolean {
  const state = useCustomerStore.getState();
  const {
    customers: all,
    updateCustomer: patch,
    setManualStops,
    setRouteStopOrder,
    setRouteStart,
    clearRouteStart,
  } = state;

  const hasCurrent =
    all.some((c) => c.isSelectedForRoute) || state.manualStops.length > 0;
  if (
    hasCurrent &&
    !confirm(
      "Replace your current route with this saved one? Your current selections and extra stops will be cleared first."
    )
  ) {
    return false;
  }

  all.forEach((c) => {
    if (c.isSelectedForRoute) patch(c.id, { isSelectedForRoute: false });
  });
  route.customerIds.forEach((id) => {
    if (all.some((c) => c.id === id)) {
      patch(id, { isSelectedForRoute: true });
    }
  });
  setManualStops(route.manualStops.map((s) => ({ ...s })));

  const customerIdSet = new Set(route.customerIds);
  const manualIdSet = new Set(route.manualStops.map((s) => s.id));
  const order: RouteStopKey[] =
    route.routeStopOrder?.filter((k) =>
      k.kind === "customer" ? customerIdSet.has(k.id) : manualIdSet.has(k.id)
    ) ?? [];
  const inOrder = new Set(order.map((k) => `${k.kind}:${k.id}`));
  for (const id of route.customerIds) {
    if (all.some((c) => c.id === id) && !inOrder.has(`customer:${id}`)) {
      order.push({ kind: "customer", id });
      inOrder.add(`customer:${id}`);
    }
  }
  for (const s of route.manualStops) {
    if (!inOrder.has(`manual:${s.id}`)) {
      order.push({ kind: "manual", id: s.id });
      inOrder.add(`manual:${s.id}`);
    }
  }
  setRouteStopOrder(order);

  if (route.routeStart !== undefined) {
    if (route.routeStart) setRouteStart({ ...route.routeStart });
    else clearRouteStart();
  }

  return true;
}

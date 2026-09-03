export function buildCookSummary(orders, mealWindow) {
  const counts = {};
  let totalMeals = 0;
  const windowOrders = (orders || []).filter((order) => order.mealWindow === mealWindow);
  for (const order of windowOrders) {
    for (const item of order.items || []) {
      counts[item.label] = (counts[item.label] || 0) + item.quantity;
      totalMeals += item.quantity;
    }
  }
  const summary = Object.entries(counts).map(([label, quantity]) => ({ label, quantity }));
  return { summary, totalMeals, orders: windowOrders };
}

export function getActiveMealWindow(now = new Date()) {
  const minutes = now.getHours() * 60 + now.getMinutes();
  const lunchCutoff = 11 * 60 + 30;
  const dinnerCutoff = 18 * 60 + 30;

  if (minutes < lunchCutoff) {
    return {
      mealWindow: "LUNCH",
      cutoffTime: "11:30 AM",
      label: "LUNCH · 11:30 AM cutoff",
      isPastCutoff: false,
    };
  }
  if (minutes < dinnerCutoff) {
    return {
      mealWindow: "DINNER",
      cutoffTime: "6:30 PM",
      label: "DINNER · 6:30 PM cutoff",
      isPastCutoff: true,
    };
  }
  return {
    mealWindow: "LUNCH",
    cutoffTime: "11:30 AM",
    label: "LUNCH · next window (today's dinner cutoff passed)",
    isPastCutoff: true,
  };
}

export const C = {
  cream: "#FBF9F6",
  orange: "#E53A00",
  orangeDark: "#C43200",
  orangeLight: "#FFF1EC",
  green: "#16A34A",
  greenLight: "#F0FDF4",
  dark: "#1E293B",
  muted: "#64748B",
  border: "#E2E8F0",
  white: "#FFFFFF",
};

export const formatINR = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

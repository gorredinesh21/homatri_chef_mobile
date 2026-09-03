import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts, Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold } from "@expo-google-fonts/figtree";
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces";
import * as ImagePicker from "expo-image-picker";
import { ChefDashboardProvider, useChefDashboard } from "./src/context/ChefDashboardContext";
import { loginMobileUser, registerMobileUser, submitChefOnboarding, uploadReel } from "./src/services/api";
import { C, formatINR } from "./src/theme";

const AUTH_STORAGE_KEY = "@homatri_chef_auth";
const MAX_REEL_BYTES = 50 * 1024 * 1024;

const TABS = [
  { key: "OVERVIEW", label: "Overview" },
  { key: "CHECKLIST", label: "Cook" },
  { key: "ORDERS", label: "Orders" },
  { key: "MENU", label: "Menu" },
  { key: "MORE", label: "More" },
];

export default function App() {
  const [token, setToken] = useState(null);
  const [phone, setPhone] = useState("");
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(AUTH_STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (saved.token && saved.phone) {
          setToken(saved.token);
          setPhone(saved.phone);
        }
      })
      .catch(() => {})
      .finally(() => setBooted(true));
  }, []);

  const persistAuth = (nextPhone, nextToken) => {
    setPhone(nextPhone);
    setToken(nextToken);
    AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ phone: nextPhone, token: nextToken })).catch(() => {});
  };

  const clearAuth = () => {
    setToken(null);
    setPhone("");
    AsyncStorage.removeItem(AUTH_STORAGE_KEY).catch(() => {});
  };

  const [fontsLoaded] = useFonts({
    Figtree_400Regular,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Fraunces_600SemiBold,
  });

  if (!fontsLoaded || !booted) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color={C.orange} />
      </View>
    );
  }

  return (
    <ChefDashboardProvider token={token}>
      <ChefShell token={token} phone={phone} onAuthed={persistAuth} onLogout={clearAuth} />
    </ChefDashboardProvider>
  );
}

function ChefShell({ token, phone, onAuthed, onLogout }) {
  const d = useChefDashboard();
  const [tab, setTab] = useState("OVERVIEW");
  const [morePage, setMorePage] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await d.refresh();
    } catch {}
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <View style={styles.header}>
        <Text style={styles.brand}>Homatri Kitchen</Text>
        <Text style={styles.sub}>
          Homemaker portal{d.cluster ? ` · ${d.cluster}` : ""}
        </Text>
      </View>
      <ScrollView
        style={styles.body}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.orange} />}
      >
        {d.loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={C.orange} />
            <Text style={styles.muted}>Loading kitchen…</Text>
          </View>
        ) : (
          <>
            {tab === "OVERVIEW" && <Overview />}
            {tab === "CHECKLIST" && <Checklist />}
            {tab === "ORDERS" && <Orders />}
            {tab === "MENU" && <Menu />}
            {tab === "MORE" && !morePage && (
              <MoreMenu
                onOpen={setMorePage}
                onOnboarding={() => setShowOnboarding(true)}
              />
            )}
            {tab === "MORE" && morePage === "REQUESTS" && <Requests onBack={() => setMorePage(null)} />}
            {tab === "MORE" && morePage === "STUDIO" && <Studio onBack={() => setMorePage(null)} token={token} />}
            {tab === "MORE" && morePage === "EARNINGS" && <Earnings onBack={() => setMorePage(null)} />}
            {tab === "MORE" && morePage === "SETTINGS" && <Settings onBack={() => setMorePage(null)} />}
            {tab === "MORE" && morePage === "AUTH" && (
              <Auth
                phone={phone}
                token={token}
                onBack={() => setMorePage(null)}
                onAuthed={onAuthed}
                onLogout={onLogout}
              />
            )}
            {showOnboarding && (
              <Onboarding
                phone={phone}
                token={token}
                onClose={() => setShowOnboarding(false)}
              />
            )}
            {d.lastUpdated ? (
              <Text style={styles.lastUpdated}>Last updated {d.lastUpdated.toLocaleTimeString("en-IN")}</Text>
            ) : null}
          </>
        )}
      </ScrollView>
      <View style={styles.tabBar}>
        {TABS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={styles.tabItem}
            onPress={() => {
              setTab(item.key);
              if (item.key !== "MORE") setMorePage(null);
            }}
          >
            <Text style={tab === item.key ? styles.tabOn : styles.tabOff}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

function Overview() {
  const d = useChefDashboard();
  return (
    <View>
      <Text style={styles.kicker}>Today’s overview</Text>
      <Text style={styles.h1}>{d.kitchen.kitchenName || "Your kitchen"}</Text>
      <Text style={styles.muted}>{d.windowInfo.label}</Text>
      <View style={styles.row}>
        <Pill
          active={d.kitchenState === "ACCEPTING_ORDERS"}
          label={d.kitchenState === "ACCEPTING_ORDERS" ? "Accepting orders" : d.kitchenState.replace(/_/g, " ")}
          onPress={d.toggleAccepting}
          disabled={d.mutating}
        />
        <Pill label="Pause kitchen" onPress={d.pauseKitchen} disabled={d.mutating} />
        <Pill label="Lock cutoff batch" onPress={d.lockBatch} disabled={d.mutating} />
      </View>
      <Text style={styles.muted}>
        Capacity {d.committedMeals}/{d.kitchen.dailyCapacity} meals · {d.remainingCapacity} remaining
      </Text>
      {d.notice ? <Text style={d.pollError ? styles.warn : styles.ok}>{d.notice}</Text> : null}
      <CookList />
    </View>
  );
}

function Checklist() {
  const d = useChefDashboard();
  return (
    <View>
      <Backless title="Cutoff cook list" kicker="Cooking checklist" />
      <Text style={styles.muted}>Aggregated from confirmed/batched demand.</Text>
      {d.notice ? <Text style={d.pollError ? styles.warn : styles.ok}>{d.notice}</Text> : null}
      <CookList />
    </View>
  );
}

function CookList() {
  const { windowInfo, cook, markPacked, isPackedReady, mutating } = useChefDashboard();
  const [open, setOpen] = useState({});
  return (
    <View style={{ marginTop: 12 }}>
      <View style={styles.grid3}>
        <Stat label="Meal window" value={windowInfo.mealWindow} />
        <Stat label="Cutoff" value={windowInfo.cutoffTime} />
        <Stat label="Tiffins" value={String(cook.totalMeals)} />
      </View>
      {cook.totalMeals === 0 ? (
        <Card>
          <Text style={styles.h2}>No orders in this window</Text>
          <Text style={styles.muted}>The cook list fills up once customers order for {windowInfo.mealWindow.toLowerCase()}.</Text>
        </Card>
      ) : (
        <Card>
          <Text style={styles.h2}>Consolidated cook summary</Text>
          {cook.summary.map((line) => (
            <View key={line.label} style={styles.line}>
              <Text style={styles.p}>{line.label}</Text>
              <Text style={styles.strong}>{line.quantity}×</Text>
            </View>
          ))}
        </Card>
      )}
      {cook.orders.map((order) => (
        <TouchableOpacity
          key={order.orderId}
          style={styles.card}
          onPress={() => setOpen((p) => ({ ...p, [order.orderId]: !p[order.orderId] }))}
        >
          <Text style={styles.strong}>{order.customerName}  <Text style={styles.muted}>{order.orderId}</Text></Text>
          {open[order.orderId]
            ? (order.items || []).map((item) => (
                <Text key={item.label} style={styles.p}>{item.quantity}× {item.label}</Text>
              ))
            : null}
          {open[order.orderId] && order.notes ? <Text style={styles.orange}>Note: {order.notes}</Text> : null}
        </TouchableOpacity>
      ))}
      <Btn
        label={isPackedReady ? "Batch packed — waiting for driver" : "Mark batch packed & ready for driver pickup"}
        color={C.green}
        disabled={isPackedReady || mutating}
        onPress={markPacked}
      />
    </View>
  );
}

function paymentBadge(order) {
  const method = order.paymentMethod || order.payment?.method || order.payment_method;
  if (!method) return null;
  if (String(method).toUpperCase() === "COD") return "Cash order";
  return String(method).replace(/_/g, " ");
}

function Orders() {
  const { orders, rider, isPackedReady } = useChefDashboard();
  return (
    <View>
      <Text style={styles.kicker}>Live orders</Text>
      <Text style={styles.h1}>Kitchen handoff</Text>
      <Card>
        <Text style={styles.kicker}>Assigned rider · 1 chef : 1 driver</Text>
        <Text style={styles.h2}>{rider.riderName}</Text>
        <Text style={styles.muted}>Vehicle {rider.vehicleNumber}</Text>
        <Text style={isPackedReady ? styles.ok : styles.muted}>
          {isPackedReady ? "Batch is packed. Rider can confirm kitchen pickup." : "Mark the batch packed on Overview before pickup."}
        </Text>
      </Card>
      {orders.length === 0 ? (
        <Card>
          <Text style={styles.h2}>No live orders</Text>
          <Text style={styles.muted}>New orders appear here as customers check out.</Text>
        </Card>
      ) : null}
      {orders.map((order) => {
        const badge = paymentBadge(order);
        return (
          <Card key={order.orderId}>
            <View style={styles.rowBetween}>
              <View>
                <Text style={styles.strong}>{order.customerName}</Text>
                <Text style={styles.muted}>{order.orderId}</Text>
              </View>
              <View style={styles.rowTight}>
                {badge ? <Text style={styles.chipCash}>{badge}</Text> : null}
                <Text style={styles.chip}>{order.status.replace(/_/g, " ")}</Text>
              </View>
            </View>
            {(order.items || []).map((item) => (
              <Text key={item.label} style={styles.p}>{item.quantity}× {item.label}</Text>
            ))}
          </Card>
        );
      })}
    </View>
  );
}

function Menu() {
  const { menuItems, createMenuItem, toggleAvailability, updateMenuItem, mutating, notice, pollError } = useChefDashboard();
  const [mealWindow, setMealWindow] = useState("LUNCH");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [desc, setDesc] = useState("");
  const [editing, setEditing] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const visible = menuItems.filter((i) => i.mealWindow === mealWindow);
  const startEdit = (item) => {
    setEditing(item.menuItemId);
    setEditDraft({ itemName: item.itemName, unitPrice: String(item.unitPrice), description: item.description || "" });
  };
  return (
    <View>
      <Text style={styles.kicker}>Menu manager</Text>
      <Text style={styles.h1}>Today’s dishes</Text>
      <View style={styles.row}>
        {["LUNCH", "DINNER"].map((w) => (
          <Pill key={w} label={w} active={mealWindow === w} onPress={() => setMealWindow(w)} />
        ))}
      </View>
      {notice ? <Text style={pollError ? styles.warn : styles.ok}>{notice}</Text> : null}
      {visible.length === 0 ? (
        <Card>
          <Text style={styles.h2}>No {mealWindow.toLowerCase()} dishes yet</Text>
          <Text style={styles.muted}>Add your first dish below to open this window for orders.</Text>
        </Card>
      ) : null}
      {visible.map((item) => (
        <Card key={item.menuItemId}>
          {editing === item.menuItemId ? (
            <>
              <Text style={styles.h2}>Edit dish</Text>
              <Field label="Name" value={editDraft.itemName} onChange={(v) => setEditDraft((p) => ({ ...p, itemName: v }))} />
              <Field label="Price" value={editDraft.unitPrice} onChange={(v) => setEditDraft((p) => ({ ...p, unitPrice: v }))} keyboard="numeric" />
              <Field label="Description" value={editDraft.description} onChange={(v) => setEditDraft((p) => ({ ...p, description: v }))} />
              <View style={styles.row}>
                <Btn
                  label="Save"
                  color={C.green}
                  disabled={mutating || !editDraft.itemName || !editDraft.unitPrice}
                  onPress={async () => {
                    try {
                      await updateMenuItem(item.menuItemId, editDraft);
                      setEditing(null);
                    } catch {}
                  }}
                />
                <Btn label="Cancel" onPress={() => setEditing(null)} disabled={mutating} />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.strong}>{item.itemName}</Text>
              <Text style={styles.orange}>{formatINR(item.unitPrice)}</Text>
              <Text style={styles.muted}>{item.description}</Text>
              <View style={styles.row}>
                <Btn
                  label={item.availability === "IN_STOCK" ? "Mark sold out" : "Mark in stock"}
                  disabled={mutating}
                  onPress={() => toggleAvailability(item.menuItemId)}
                />
                <Btn label="Edit dish" disabled={mutating} onPress={() => startEdit(item)} />
              </View>
            </>
          )}
        </Card>
      ))}
      <Card>
        <Text style={styles.h2}>Add dish</Text>
        <Field label="Name" value={name} onChange={setName} />
        <Field label="Price" value={price} onChange={setPrice} keyboard="numeric" />
        <Field label="Description" value={desc} onChange={setDesc} />
        <Btn
          label={mutating ? "Saving…" : "Create menu item"}
          disabled={mutating}
          onPress={async () => {
            if (!name || !price) return Alert.alert("Menu", "Name and price required.");
            try {
              await createMenuItem({ itemName: name, description: desc, unitPrice: price, mealWindow, availability: "IN_STOCK" });
              setName(""); setPrice(""); setDesc("");
            } catch {}
          }}
        />
      </Card>
    </View>
  );
}

function MoreMenu({ onOpen, onOnboarding }) {
  const { token } = useChefDashboard();
  const items = [
    ["STUDIO", "Content studio"],
    ["REQUESTS", "Dietary requests"],
    ["EARNINGS", "Earnings & payouts"],
    ["SETTINGS", "Kitchen settings"],
    ["AUTH", token ? "Account" : "Sign in"],
  ];
  return (
    <View>
      <Text style={styles.kicker}>Kitchen</Text>
      <Text style={styles.h1}>More</Text>
      {items.map(([key, label]) => (
        <TouchableOpacity key={key} style={styles.card} onPress={() => onOpen(key)}>
          <Text style={styles.strong}>{label} ➔</Text>
        </TouchableOpacity>
      ))}
      <Btn label="Homemaker onboarding" onPress={onOnboarding} />
    </View>
  );
}

function Requests({ onBack }) {
  const { dietaryRequests, acceptDietary, rejectDietary, counterDietary, mutating, notice, pollError } = useChefDashboard();
  const [draft, setDraft] = useState({});
  const actionable = (r) => r.status === "WAITING_CHEF" || r.status === "COUNTERED";
  const canCounter = (r) => actionable(r) && r.counterTurnCount < r.maxCounterTurns;
  return (
    <View>
      <Back onBack={onBack} kicker="Dietary requests" title="Customization notes" />
      {notice ? <Text style={pollError ? styles.warn : styles.ok}>{notice}</Text> : null}
      {dietaryRequests.length === 0 ? (
        <Card>
          <Text style={styles.h2}>No dietary requests</Text>
          <Text style={styles.muted}>Customer customization notes will show up here.</Text>
        </Card>
      ) : null}
      {dietaryRequests.map((r) => (
        <Card key={r.requestId}>
          <Text style={styles.kicker}>{r.status.replace(/_/g, " ")}</Text>
          <Text style={styles.h2}>{r.customerName || `Customer ${r.customerPhone || ""}`}</Text>
          <Text style={styles.muted}>Order {r.orderId} · turn {r.counterTurnCount}/{r.maxCounterTurns}</Text>
          <Text style={styles.quote}>“{r.note}”</Text>
          {r.counterOffer ? <Text style={styles.orange}>Counter-offer: {r.counterOffer}</Text> : null}
          {actionable(r) ? (
            <>
              <View style={styles.row}>
                <Btn
                  label={mutating ? "Working…" : "Accept"}
                  color={C.green}
                  disabled={mutating}
                  onPress={async () => {
                    try { await acceptDietary(r.requestId); } catch {}
                  }}
                />
                <Btn
                  label="Reject"
                  disabled={mutating}
                  onPress={async () => {
                    try { await rejectDietary(r.requestId); } catch {}
                  }}
                />
              </View>
              {canCounter(r) ? (
                <>
                  <Field label="Counter-offer" value={draft[r.requestId] || ""} onChange={(v) => setDraft((p) => ({ ...p, [r.requestId]: v }))} />
                  <Btn
                    label={mutating ? "Sending…" : "Send counter-offer"}
                    disabled={mutating || !draft[r.requestId]}
                    onPress={async () => {
                      try {
                        await counterDietary(r.requestId, draft[r.requestId]);
                        setDraft((p) => ({ ...p, [r.requestId]: "" }));
                      } catch {}
                    }}
                  />
                </>
              ) : null}
            </>
          ) : (
            <Text style={styles.ok}>
              {r.status === "ACCEPTED" ? "Accepted — cook to note." : r.status === "REJECTED" ? "Rejected." : "No further action needed."}
            </Text>
          )}
        </Card>
      ))}
    </View>
  );
}

function Studio({ onBack, token }) {
  const { menuItems, reels, addReel, refresh, notice, pollError } = useChefDashboard();
  const [caption, setCaption] = useState("");
  const [video, setVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const pickVideo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Studio", "Media library permission is needed to pick a reel.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      quality: 1,
      allowsEditing: true,
      aspect: [9, 16],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_REEL_BYTES) {
      Alert.alert("Reel too large", `Videos must be under 50 MB (picked ${(asset.fileSize / (1024 * 1024)).toFixed(1)} MB).`);
      return;
    }
    setVideo({ uri: asset.uri, fileName: asset.fileName || asset.uri.split("/").pop(), fileSize: asset.fileSize });
  };

  const publish = async () => {
    if (!video) {
      Alert.alert("Studio", "Pick a vertical video first.");
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      await uploadReel({ uri: video.uri, caption }, token, setProgress);
      await addReel();
      setCaption("");
      setVideo(null);
      Alert.alert("Studio", "Reel published.");
    } catch (e) {
      Alert.alert("Upload failed", e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View>
      <Back onBack={onBack} kicker="Content studio" title="Cooking vlogs" />
      {notice ? <Text style={pollError ? styles.warn : styles.ok}>{notice}</Text> : null}
      <Card>
        <Text style={styles.h2}>Upload a cooking reel</Text>
        <Text style={styles.muted}>Vertical 9:16, 15–60 seconds, up to 50 MB.</Text>
        <Field label="Caption" value={caption} onChange={setCaption} />
        <Btn label={video ? `Video: ${video.fileName}` : "Pick video"} onPress={pickVideo} disabled={uploading} />
        <Btn
          label={uploading ? `Uploading… ${Math.round(progress * 100)}%` : "Publish reel"}
          color={C.green}
          disabled={uploading || !video}
          onPress={publish}
        />
        {uploading ? <ActivityIndicator style={{ marginTop: 10 }} color={C.orange} /> : null}
        <Text style={styles.muted}>{menuItems.length} dishes can be tagged.</Text>
      </Card>
      {reels.length === 0 ? (
        <Card>
          <Text style={styles.h2}>No reels yet</Text>
          <Text style={styles.muted}>Publish your first cooking vlog above.</Text>
        </Card>
      ) : null}
      {reels.map((reel) => (
        <Card key={reel.reelId}>
          <Text style={styles.strong}>{reel.caption}</Text>
          <Text style={styles.muted}>{reel.likeCount} likes · {reel.viewCount} views · {reel.commentCount || 0} comments</Text>
        </Card>
      ))}
    </View>
  );
}

function Earnings({ onBack }) {
  const { earnings } = useChefDashboard();
  const cards = [
    ["Today’s kitchen income", formatINR(earnings.todayIncome)],
    ["Weekly payout", formatINR(earnings.weeklyPayout)],
    ["Completed orders", String(earnings.completedOrders)],
    ["Repeat customer retention", `${earnings.repeatRetentionPct}%`],
  ];
  return (
    <View>
      <Back onBack={onBack} kicker="Earnings & payouts" title="Your kitchen ledger" />
      {cards.map(([label, value]) => (
        <Card key={label}>
          <Text style={styles.kicker}>{label}</Text>
          <Text style={styles.h1}>{value}</Text>
        </Card>
      ))}
    </View>
  );
}

function Settings({ onBack }) {
  const { kitchen, setKitchen, mutating } = useChefDashboard();
  const [draft, setDraft] = useState(kitchen);
  const [saved, setSaved] = useState(false);
  const set = (k, v) => { setDraft((p) => ({ ...p, [k]: v })); setSaved(false); };
  return (
    <View>
      <Back onBack={onBack} kicker="Kitchen settings" title="Brand & capacity" />
      <Card>
        <Field label="Kitchen name" value={draft.kitchenName} onChange={(v) => set("kitchenName", v)} />
        <Field label="Chef name" value={draft.chefName} onChange={(v) => set("chefName", v)} />
        <Field label="Address" value={draft.address} onChange={(v) => set("address", v)} />
        <Field label="Hometown region" value={draft.hometownRegion} onChange={(v) => set("hometownRegion", v)} />
        <Field label="Daily capacity" value={String(draft.dailyCapacity)} onChange={(v) => set("dailyCapacity", v)} keyboard="numeric" />
        <Btn
          label={mutating ? "Saving…" : "Save kitchen profile"}
          disabled={mutating}
          onPress={async () => {
            try {
              await setKitchen({ ...draft, dailyCapacity: Number(draft.dailyCapacity) || 0 });
              setSaved(true);
            } catch {}
          }}
        />
        {saved ? <Text style={styles.ok}>Kitchen profile saved.</Text> : null}
      </Card>
    </View>
  );
}

function Auth({ onBack, onAuthed, onLogout, phone, token }) {
  const [mode, setMode] = useState("LOG_IN");
  const [p, setP] = useState(phone || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <View>
      <Back onBack={onBack} kicker="Account" title={mode === "SIGN_UP" ? "Create kitchen login" : "Welcome back"} />
      <Field label="Phone" value={p} onChange={setP} keyboard="phone-pad" />
      {mode === "SIGN_UP" ? <Field label="Email" value={email} onChange={setEmail} /> : null}
      <Field label="Password" value={password} onChange={setPassword} secure />
      {mode === "SIGN_UP" ? <Field label="Full name" value={name} onChange={setName} /> : null}
      <Btn
        label={busy ? "Please wait…" : mode === "SIGN_UP" ? "Sign up" : "Log in"}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          try {
            const res = mode === "SIGN_UP"
              ? await registerMobileUser({ phone: p, email, password, fullName: name })
              : await loginMobileUser({ phone: p, password });
            onAuthed(p, res.access_token);
            Alert.alert("Signed in", "You can finish homemaker onboarding next.");
          } catch (e) {
            Alert.alert("Auth", e.message);
          } finally {
            setBusy(false);
          }
        }}
      />
      <TouchableOpacity onPress={() => setMode(mode === "SIGN_UP" ? "LOG_IN" : "SIGN_UP")}>
        <Text style={styles.orange}>{mode === "SIGN_UP" ? "Already have an account? Log in" : "Need an account? Sign up"}</Text>
      </TouchableOpacity>
      {token ? (
        <>
          <Text style={styles.ok}>Session active for +91 {phone}</Text>
          <Btn
            label="Log out"
            onPress={() => {
              onLogout();
              Alert.alert("Logged out", "Session cleared on this device.");
            }}
          />
        </>
      ) : null}
    </View>
  );
}

function Onboarding({ phone, token, onClose }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    chef_phone: phone || "",
    chef_name: "",
    kitchen_name: "",
    bio: "",
    hometown_region: "",
    fssai_license_number: "",
    daily_capacity: "15",
    address_line1: "",
    city: "Navi Mumbai",
    latitude: "19.1197",
    longitude: "73.0078",
    payout_upi_id: "",
    avatar_url: "avatar_chef_cartoon_1.png",
  });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const steps = ["Kitchen story", "FSSAI", "Kitchen pin", "Payout"];
  const canNext = useMemo(() => {
    if (step === 0) return form.chef_name && form.kitchen_name && form.bio && form.hometown_region && form.chef_phone.length >= 10;
    if (step === 1) return /^\d{14}$/.test(form.fssai_license_number);
    if (step === 2) return form.address_line1;
    return /.+@.+/.test(form.payout_upi_id);
  }, [form, step]);

  return (
    <View>
      <Back onBack={onClose} kicker="Homemaker onboarding" title="Set up your home kitchen" />
      <Text style={styles.strong}>{steps[step]}</Text>
      {step === 0 && (
        <>
          <Field label="Mobile number" value={form.chef_phone} onChange={(v) => set("chef_phone", v)} />
          <Field label="Legal name" value={form.chef_name} onChange={(v) => set("chef_name", v)} />
          <Field label="Kitchen name" value={form.kitchen_name} onChange={(v) => set("kitchen_name", v)} />
          <Field label="Hometown region" value={form.hometown_region} onChange={(v) => set("hometown_region", v)} />
          <Field label="Bio" value={form.bio} onChange={(v) => set("bio", v)} />
        </>
      )}
      {step === 1 && <Field label="14-digit FSSAI" value={form.fssai_license_number} onChange={(v) => set("fssai_license_number", v.replace(/\D/g, "").slice(0, 14))} />}
      {step === 2 && (
        <>
          <Field label="Daily capacity" value={form.daily_capacity} onChange={(v) => set("daily_capacity", v)} />
          <Field label="Kitchen address" value={form.address_line1} onChange={(v) => set("address_line1", v)} />
          <Field label="City" value={form.city} onChange={(v) => set("city", v)} />
          <Field label="Latitude" value={form.latitude} onChange={(v) => set("latitude", v)} />
          <Field label="Longitude" value={form.longitude} onChange={(v) => set("longitude", v)} />
        </>
      )}
      {step === 3 && <Field label="Payout UPI ID" value={form.payout_upi_id} onChange={(v) => set("payout_upi_id", v)} />}
      <View style={styles.row}>
        {step > 0 ? <Btn label="Back" onPress={() => setStep((s) => s - 1)} /> : null}
        <Btn
          label={step === 3 ? "Finish kitchen setup" : "Continue"}
          disabled={!canNext}
          onPress={async () => {
            if (step < 3) return setStep((s) => s + 1);
            try {
              await submitChefOnboarding({
                ...form,
                chef_phone: form.chef_phone.replace(/\D/g, "").slice(-10),
                daily_capacity: Number(form.daily_capacity),
                latitude: Number(form.latitude),
                longitude: Number(form.longitude),
              }, token);
              Alert.alert("Kitchen ready", `${form.kitchen_name} is listed for tiffins.`);
              onClose();
            } catch (e) {
              Alert.alert("Onboarding", e.message);
            }
          }}
        />
      </View>
    </View>
  );
}

function Back({ onBack, kicker, title }) {
  return (
    <View>
      <TouchableOpacity onPress={onBack}><Text style={styles.orange}>← Back</Text></TouchableOpacity>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.h1}>{title}</Text>
    </View>
  );
}
function Backless({ title, kicker }) {
  return (
    <View>
      <Text style={styles.kicker}>{kicker}</Text>
      <Text style={styles.h1}>{title}</Text>
    </View>
  );
}
function Card({ children }) {
  return <View style={styles.card}>{children}</View>;
}
function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.kicker}>{label}</Text>
      <Text style={styles.h2}>{value}</Text>
    </View>
  );
}
function Pill({ label, active, onPress, disabled }) {
  return (
    <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.pill, active && styles.pillOn]}>
      <Text style={[styles.pillText, active && { color: C.white }]}>{label}</Text>
    </TouchableOpacity>
  );
}
function Btn({ label, onPress, color = C.orange, disabled }) {
  return (
    <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.btn, { backgroundColor: color, opacity: disabled ? 0.5 : 1 }]}>
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  );
}
function Field({ label, value, onChange, keyboard, secure }) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.kicker}>{label}</Text>
      <TextInput value={String(value ?? "")} onChangeText={onChange} keyboardType={keyboard} secureTextEntry={secure} style={styles.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  header: { backgroundColor: C.white, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: C.border },
  brand: { fontSize: 22, fontWeight: "bold", color: C.orange, fontStyle: "italic", fontFamily: "Fraunces_600SemiBold" },
  sub: { fontSize: 11, color: C.muted, marginTop: 2 },
  body: { flex: 1, padding: 16 },
  kicker: { fontSize: 11, fontWeight: "bold", color: C.orange, textTransform: "uppercase", letterSpacing: 1, marginTop: 8, fontFamily: "Figtree_700Bold" },
  h1: { fontSize: 26, fontWeight: "600", color: C.dark, marginTop: 4, fontFamily: "Fraunces_600SemiBold" },
  h2: { fontSize: 18, fontWeight: "600", color: C.dark, marginTop: 6, fontFamily: "Figtree_600SemiBold" },
  muted: { fontSize: 13, color: C.muted, marginTop: 4, fontFamily: "Figtree_400Regular" },
  p: { fontSize: 13, color: C.dark, marginTop: 4, fontFamily: "Figtree_400Regular" },
  strong: { fontSize: 15, fontWeight: "bold", color: C.dark, fontFamily: "Figtree_700Bold" },
  orange: { color: C.orange, fontWeight: "bold", marginTop: 8, fontFamily: "Figtree_600SemiBold" },
  ok: { color: C.green, marginTop: 8, fontFamily: "Figtree_600SemiBold" },
  warn: { color: C.orangeDark, marginTop: 8, fontFamily: "Figtree_600SemiBold" },
  quote: { backgroundColor: C.cream, padding: 10, borderRadius: 12, marginTop: 8, fontSize: 13, fontFamily: "Figtree_400Regular" },
  lastUpdated: { fontSize: 11, color: C.muted, textAlign: "center", marginTop: 16, fontFamily: "Figtree_400Regular" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 10 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between" },
  rowTight: { flexDirection: "row", gap: 6, alignItems: "center" },
  pill: { borderWidth: 1, borderColor: C.border, backgroundColor: C.white, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  pillOn: { backgroundColor: C.orange, borderColor: C.orange },
  pillText: { fontSize: 12, fontWeight: "bold", color: C.dark, fontFamily: "Figtree_600SemiBold" },
  card: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 20, padding: 14, marginTop: 10 },
  line: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderColor: C.border },
  grid3: { flexDirection: "row", gap: 8, marginTop: 8 },
  stat: { flex: 1, backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 10 },
  chip: { fontSize: 10, fontWeight: "bold", backgroundColor: C.cream, color: C.dark, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, overflow: "hidden", fontFamily: "Figtree_600SemiBold" },
  chipCash: { fontSize: 10, fontWeight: "bold", backgroundColor: C.greenLight, color: C.green, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, overflow: "hidden", fontFamily: "Figtree_600SemiBold" },
  btn: { marginTop: 10, paddingVertical: 12, borderRadius: 14, alignItems: "center", flex: 1 },
  btnText: { color: C.white, fontWeight: "bold", fontFamily: "Figtree_700Bold" },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 10, marginTop: 4, backgroundColor: C.cream, color: C.dark, fontFamily: "Figtree_400Regular" },
  tabBar: { flexDirection: "row", backgroundColor: C.white, borderTopWidth: 1, borderColor: C.border, paddingVertical: 12 },
  tabItem: { flex: 1, alignItems: "center" },
  tabOn: { color: C.orange, fontWeight: "bold", fontSize: 12, fontFamily: "Figtree_700Bold" },
  tabOff: { color: C.muted, fontSize: 12, fontFamily: "Figtree_400Regular" },
});

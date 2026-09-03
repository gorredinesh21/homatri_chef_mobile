import { getApiBaseUrl } from "../config";

async function parseError(res) {
  try {
    const err = await res.json();
    const detail = err.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((d) => d.msg || d).join(" ");
    return JSON.stringify(detail || err);
  } catch {
    return `Request failed (${res.status})`;
  }
}

async function apiRequest(path, { method = "GET", body, token } = {}) {
  const base = getApiBaseUrl();
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new Error(`Cannot reach Homatri server at ${base}. (${error.message})`);
  }
  if (!response.ok) throw new Error(await parseError(response));
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function registerMobileUser({ phone, email, password, fullName }) {
  return apiRequest("/api/v1/auth/register", {
    method: "POST",
    body: { phone, email, password, full_name: fullName },
  });
}

export async function loginMobileUser({ phone, password }) {
  return apiRequest("/api/v1/auth/login", { method: "POST", body: { phone, password } });
}

export async function submitChefOnboarding(body, token) {
  return apiRequest("/api/v1/auth/onboarding/chef", { method: "POST", token, body });
}

export async function fetchChefDashboard(token) {
  return apiRequest("/api/v1/chef/me", { token });
}

export async function chefSetAccepting(accepting, token) {
  return apiRequest("/api/v1/chef/me/accepting", { method: "POST", token, body: { accepting } });
}

export async function chefPauseKitchen(token) {
  return apiRequest("/api/v1/chef/me/pause", { method: "POST", token });
}

export async function chefLockBatch(token) {
  return apiRequest("/api/v1/chef/me/lock-batch", { method: "POST", token });
}

export async function chefMarkPacked(token) {
  return apiRequest("/api/v1/chef/me/packed", { method: "POST", token });
}

export async function chefCreateMenu(body, token) {
  return apiRequest("/api/v1/chef/me/menu", { method: "POST", token, body });
}

export async function chefToggleStock(menuItemId, token) {
  return apiRequest(`/api/v1/chef/me/menu/${menuItemId}/stock`, { method: "PATCH", token });
}

export async function chefPatchMenuItem(menuItemId, body, token) {
  return apiRequest(`/api/v1/chef/me/menu/${menuItemId}`, { method: "PATCH", token, body });
}

export async function respondDietaryRequest(requestId, body, token) {
  return apiRequest(`/api/v1/chef/me/dietary/${requestId}/respond`, {
    method: "POST",
    token,
    body,
  });
}

export function uploadReel({ uri, caption, featuredMenuItemId }, token, onProgress) {
  const base = getApiBaseUrl();
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("video", {
      uri,
      name: uri.split("/").pop() || "reel.mp4",
      type: "video/mp4",
    });
    form.append("caption", caption || "");
    if (featuredMenuItemId) form.append("featured_menu_item_id", featuredMenuItemId);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${base}/api/v1/reels/upload`);
    xhr.setRequestHeader("Accept", "application/json");
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(event.loaded / event.total);
      };
    }
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(xhr.responseText ? JSON.parse(xhr.responseText) : null);
        } catch {
          resolve(null);
        }
      } else {
        let detail = `Upload failed (${xhr.status})`;
        try {
          const err = JSON.parse(xhr.responseText);
          if (typeof err.detail === "string") detail = err.detail;
        } catch {}
        reject(new Error(detail));
      }
    };
    xhr.onerror = () => reject(new Error(`Cannot reach Homatri server at ${base}.`));
    xhr.send(form);
  });
}

export async function chefPatchKitchen(body, token) {
  return apiRequest("/api/v1/chef/me/kitchen", { method: "PATCH", token, body });
}

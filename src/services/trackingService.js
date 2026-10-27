import { apiRequest } from "../utils/apiClient";

// Meta Pixel + Conversions API for the public landing pages served from this app
// (?landingPageId=…). Mirrors the storefront (holygift-frontend/src/lib/pixel.ts):
// PageView, ViewContent, AddToCart and InitiateCheckout fire in the browser and
// are posted to /tracking/events with the same event id. Purchase is sent by the
// backend from the saved order; the browser only fires its copy with the event id
// and values the order API returns.

let initializationPromise = null;
// Dashboard previews must not send real events to the live pixels / Conversions API.
let trackingSuspended = false;

export function setTrackingSuspended(value) {
  trackingSuspended = Boolean(value);
}
let pixelIds = [];

const SERVER_EVENTS = new Set(["PageView", "ViewContent", "AddToCart", "InitiateCheckout"]);
const FBC_MAX_AGE_S = 90 * 24 * 60 * 60;

function createEventId(eventName) {
  const random = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return `${eventName.toLowerCase()}_${random}`;
}

function getCookie(name) {
  if (typeof document === "undefined") return "";
  const prefix = `${name}=`;
  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length) || "";
  return value ? decodeURIComponent(value) : "";
}

// Stores fbclid from a Meta ad click as _fbc (fb.1.<first-seen ms>.<fbclid>);
// the same fbclid keeps its first timestamp and nothing is written without one.
function captureFbclid() {
  if (typeof window === "undefined") return;
  const fbclid = (new URLSearchParams(window.location.search).get("fbclid") || "").trim();
  if (!fbclid || !/^[\w-]{10,500}$/.test(fbclid)) return;
  if (getCookie("_fbc").split(".").slice(3).join(".") === fbclid) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `_fbc=fb.1.${Date.now()}.${fbclid}; Max-Age=${FBC_MAX_AGE_S}; Path=/; SameSite=Lax${secure}`;
}

function attribution() {
  return { fbp: getCookie("_fbp") || undefined, fbc: getCookie("_fbc") || undefined };
}

// Attribution saved with an order; the backend re-validates every field.
function getClickData() {
  if (typeof window === "undefined") return {};
  captureFbclid();
  const params = new URLSearchParams(window.location.search);
  return {
    ...attribution(),
    eventSourceUrl: window.location.href,
    gclid: params.get("gclid") || undefined,
    gbraid: params.get("gbraid") || undefined,
    wbraid: params.get("wbraid") || undefined,
    ttclid: params.get("ttclid") || undefined,
    ttp: getCookie("_ttp") || undefined,
  };
}

function installMetaPixel() {
  if (typeof window === "undefined") return;
  if (!window.fbq) {
    const fbq = function fbq(...args) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    };
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    // PageView is tracked explicitly (with an event id), not on history changes.
    fbq.disablePushState = true;
    window.fbq = fbq;
    window._fbq = fbq;
  }
  if (!document.querySelector("script[data-holydeen-meta-pixel]")) {
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.dataset.holydeenMetaPixel = "true";
    document.head.appendChild(script);
  }
}

export async function initializeTracking() {
  if (initializationPromise) return initializationPromise;
  captureFbclid();
  initializationPromise = apiRequest("/tracking/config")
    .then((response) => {
      const metaPixels = Array.isArray(response?.data?.metaPixels) ? response.data.metaPixels : [];
      pixelIds = [...new Set(metaPixels.map((pixel) => pixel.pixelsId).filter(Boolean))];
      if (pixelIds.length) {
        installMetaPixel();
        pixelIds.forEach((id) => window.fbq("init", id));
      }
      return { metaPixels };
    })
    .catch((error) => {
      initializationPromise = null;
      throw error;
    });
  return initializationPromise;
}

// trackSingle targets each configured pixel explicitly.
function trackInBrowser(eventName, eventId, customData) {
  pixelIds.forEach((id) => {
    window.fbq?.("trackSingle", id, eventName, customData, { eventID: eventId });
  });
}

export function getTrackingClickData() {
  return getClickData();
}

/**
 * @param {"PageView"|"ViewContent"|"AddToCart"|"InitiateCheckout"|"Purchase"} eventName
 *   Purchase needs the `eventId` from the order API and is never posted to the server.
 */
export async function trackMarketingEvent(
  eventName,
  { customData = {}, eventId: suppliedEventId, enabled = true } = {},
) {
  if (!enabled || trackingSuspended) return null;
  const isPurchase = eventName === "Purchase";
  if (!isPurchase && !SERVER_EVENTS.has(eventName)) return null;
  if (isPurchase && !suppliedEventId) return null;
  try {
    await initializeTracking();
    if (trackingSuspended) return null;
    captureFbclid();
    const eventId = suppliedEventId || createEventId(eventName);
    trackInBrowser(eventName, eventId, customData);
    if (isPurchase) return eventId;
    await apiRequest("/tracking/events", {
      method: "POST",
      body: JSON.stringify({
        eventName,
        eventId,
        eventSourceUrl: window.location.href,
        attribution: attribution(),
        customData: eventName === "PageView" ? undefined : customData,
      }),
    });
    return eventId;
  } catch (error) {
    console.warn(`Marketing event "${eventName}" failed`, error);
    return null;
  }
}

export function resetTrackingForTests() {
  initializationPromise = null;
  pixelIds = [];
}

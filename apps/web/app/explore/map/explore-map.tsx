"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { sellersApi } from "../../../lib/api/sellers";
import type { Seller } from "../../../lib/api/types";
import { BottomNavigation } from "../../components/bottom-navigation";
import { useRequest } from "../../hooks/use-request";
import "./map.css";

const NIGERIA_CENTER: [number, number] = [8.6753, 9.082];
const MAP_STYLE =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ??
  "https://tiles.openfreemap.org/styles/liberty";
const MAPLIBRE_VERSION = "5.24.0";
const MAPLIBRE_SCRIPT = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.js`;
const MAPLIBRE_CSS = `https://unpkg.com/maplibre-gl@${MAPLIBRE_VERSION}/dist/maplibre-gl.css`;

type LngLatLike = [number, number];
type BoundsLike = {
  extend(value: LngLatLike): BoundsLike;
  isEmpty(): boolean;
};
type MapLike = {
  on(event: "load", handler: () => void): void;
  remove(): void;
  fitBounds(bounds: BoundsLike, options: Record<string, unknown>): void;
  easeTo(options: Record<string, unknown>): void;
  flyTo(options: Record<string, unknown>): void;
  getZoom(): number;
};
type MarkerLike = {
  setLngLat(value: LngLatLike): MarkerLike;
  addTo(map: MapLike): MarkerLike;
  remove(): void;
};
type MapLibreRuntime = {
  Map: new (options: Record<string, unknown>) => MapLike;
  Marker: new (options: Record<string, unknown>) => MarkerLike;
  LngLatBounds: new () => BoundsLike;
};

declare global {
  interface Window {
    maplibregl?: MapLibreRuntime;
  }
}

let mapLibrePromise: Promise<MapLibreRuntime> | null = null;

function loadMapLibre() {
  if (typeof window === "undefined")
    return Promise.reject(new Error("Map is only available in the browser."));
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  if (mapLibrePromise) return mapLibrePromise;

  mapLibrePromise = new Promise<MapLibreRuntime>((resolve, reject) => {
    if (
      !document.querySelector(
        `link[data-eazicart-maplibre="${MAPLIBRE_VERSION}"]`,
      )
    ) {
      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = MAPLIBRE_CSS;
      stylesheet.dataset.eazicartMaplibre = MAPLIBRE_VERSION;
      document.head.appendChild(stylesheet);
    }

    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-eazicart-maplibre="${MAPLIBRE_VERSION}"]`,
    );
    const complete = () => {
      if (window.maplibregl) resolve(window.maplibregl);
      else reject(new Error("Map library did not load."));
    };
    if (existing) {
      existing.addEventListener("load", complete, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Map library failed to load.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = MAPLIBRE_SCRIPT;
    script.async = true;
    script.dataset.eazicartMaplibre = MAPLIBRE_VERSION;
    script.addEventListener("load", complete, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Map library failed to load.")),
      { once: true },
    );
    document.head.appendChild(script);
  });
  return mapLibrePromise;
}

type UserPosition = { latitude: number; longitude: number };

export function ExploreMap() {
  const sellers = useRequest(() => sellersApi.map(), []);
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLike | null>(null);
  const runtimeRef = useRef<MapLibreRuntime | null>(null);
  const sellerMarkers = useRef<MarkerLike[]>([]);
  const userMarker = useRef<MarkerLike | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [is3d, setIs3d] = useState(true);

  const mappedSellers = useMemo(
    () =>
      (sellers.data?.data ?? []).filter(
        (
          seller,
        ): seller is Seller & { location: NonNullable<Seller["location"]> } =>
          Boolean(
            seller.location &&
            Number.isFinite(seller.location.latitude) &&
            Number.isFinite(seller.location.longitude),
          ),
      ),
    [sellers.data],
  );

  const visibleSellers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return mappedSellers;
    return mappedSellers.filter((seller) =>
      [seller.displayName, seller.bio ?? "", seller.location.label ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [mappedSellers, query]);

  const selected =
    visibleSellers.find((seller) => seller.id === selectedId) ?? null;

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    let cancelled = false;
    let map: MapLike | null = null;

    void loadMapLibre()
      .then((runtime) => {
        if (cancelled || !mapNode.current) return;
        runtimeRef.current = runtime;
        map = new runtime.Map({
          container: mapNode.current,
          style: MAP_STYLE,
          center: NIGERIA_CENTER,
          zoom: 5.2,
          pitch: 52,
          bearing: -8,
        });
        mapRef.current = map;
        map.on("load", () => {
          if (!cancelled) setMapReady(true);
        });
      })
      .catch(() => {
        if (!cancelled) setLocationError("Unable to load the map right now.");
      });

    return () => {
      cancelled = true;
      sellerMarkers.current.forEach((marker) => marker.remove());
      sellerMarkers.current = [];
      userMarker.current?.remove();
      userMarker.current = null;
      mapRef.current = null;
      runtimeRef.current = null;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    sellerMarkers.current.forEach((marker) => marker.remove());
    const runtime = runtimeRef.current;
    if (!runtime) return;

    sellerMarkers.current = visibleSellers.map((seller) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `sellerMapMarker${selectedId === seller.id ? " isSelected" : ""}`;
      button.setAttribute("aria-label", `View ${seller.displayName}`);
      button.innerHTML = `<span>${escapeText(seller.displayName.slice(0, 1).toUpperCase())}</span><b>${escapeText(seller.displayName)}</b>`;
      button.addEventListener("click", () => setSelectedId(seller.id));
      return new runtime.Marker({ element: button, anchor: "bottom" })
        .setLngLat([seller.location.longitude, seller.location.latitude])
        .addTo(map);
    });

    if (visibleSellers.length && !userPosition) {
      const bounds = new runtime.LngLatBounds();
      visibleSellers.forEach((seller) =>
        bounds.extend([seller.location.longitude, seller.location.latitude]),
      );
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: { top: 130, right: 70, bottom: 180, left: 70 },
          maxZoom: 14,
          duration: 700,
        });
      }
    }

    return () => {
      sellerMarkers.current.forEach((marker) => marker.remove());
      sellerMarkers.current = [];
    };
  }, [mapReady, selectedId, userPosition, visibleSellers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.easeTo({ pitch: is3d ? 52 : 0, bearing: is3d ? -8 : 0, duration: 450 });
  }, [is3d, mapReady]);

  const locate = () => {
    if (!navigator.geolocation) {
      setLocationError("Location is not supported in this browser.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserPosition(next);
        setLocating(false);
        const map = mapRef.current;
        if (!map) return;
        userMarker.current?.remove();
        const marker = document.createElement("div");
        marker.className = "userMapMarker";
        marker.setAttribute("aria-label", "Your location");
        const runtime = runtimeRef.current;
        if (!runtime) return;
        userMarker.current = new runtime.Marker({ element: marker })
          .setLngLat([next.longitude, next.latitude])
          .addTo(map);
        map.flyTo({
          center: [next.longitude, next.latitude],
          zoom: Math.max(map.getZoom(), 14),
          pitch: is3d ? 52 : 0,
          duration: 800,
        });
      },
      (error) => {
        setLocating(false);
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "Location access was not allowed."
            : "Unable to get your current location.",
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  return (
    <main className="mapPage">
      <div
        ref={mapNode}
        className="mapCanvas"
        aria-label="EaziCart store map"
      />

      <header className="mapHeader">
        <Link href="/explore" className="round" aria-label="Back to Explore">
          ‹
        </Link>
        <label className="search">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search stores on the map"
            aria-label="Search stores on the map"
          />
        </label>
      </header>

      <div className="mapStatus" aria-live="polite">
        {sellers.loading
          ? "Loading store locations…"
          : sellers.error
            ? "Store locations unavailable"
            : `${visibleSellers.length} mapped ${visibleSellers.length === 1 ? "store" : "stores"}`}
      </div>

      <div className="controls">
        <button type="button" onClick={() => setIs3d((value) => !value)}>
          {is3d ? "2D" : "3D"}
        </button>
        <button type="button" onClick={locate} aria-label="Use my location">
          {locating ? "…" : "⌖"}
        </button>
      </div>

      {!sellers.loading && !sellers.error && !mappedSellers.length ? (
        <section className="mapEmpty">
          <strong>No stores have shared a map location yet.</strong>
          <p>
            Store pins appear only when an EaziCart seller explicitly shares a
            real storefront location.
          </p>
        </section>
      ) : null}

      {sellers.error ? (
        <section className="mapEmpty" role="alert">
          <strong>Couldn&apos;t load store locations.</strong>
          <button type="button" onClick={() => void sellers.reload()}>
            Try again
          </button>
        </section>
      ) : null}

      {locationError ? <p className="locationError">{locationError}</p> : null}

      {selected ? (
        <section
          className="storeCard"
          aria-label={`${selected.displayName} map details`}
        >
          <button
            className="close"
            type="button"
            onClick={() => setSelectedId(null)}
            aria-label="Close store details"
          >
            ×
          </button>
          <div className="storeIcon" aria-hidden="true">
            {selected.displayName.slice(0, 1).toUpperCase()}
          </div>
          <div className="storeInfo">
            <strong>{selected.displayName}</strong>
            {selected.location.label ? <p>{selected.location.label}</p> : null}
            <small>
              {selected._count?.products ?? 0} active products
              {userPosition
                ? ` · ${distanceLabel(userPosition, selected.location)}`
                : ""}
            </small>
          </div>
          <Link href={`/seller/${selected.id}`} className="shop">
            View store
          </Link>
        </section>
      ) : null}

      <BottomNavigation />
    </main>
  );
}

function distanceLabel(
  from: UserPosition,
  to: { latitude: number; longitude: number },
) {
  const radius = 6371;
  const dLat = radians(to.latitude - from.latitude);
  const dLon = radians(to.longitude - from.longitude);
  const lat1 = radians(from.latitude);
  const lat2 = radians(to.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const distance = radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return distance < 1
    ? `${Math.round(distance * 1000)} m away`
    : `${distance.toFixed(distance < 10 ? 1 : 0)} km away`;
}

function radians(value: number) {
  return (value * Math.PI) / 180;
}

function escapeText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

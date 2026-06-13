"use client";

import { useRef, useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import Map, { Source, Layer, Marker, type MapRef } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Contribution } from "@/types/contribution";
import { useI18n } from "@/contexts/I18nContext";

interface TrasaPoint {
  contribution: Contribution;
  lng: number;
  lat: number;
}

interface Props {
  eventTitle: string;
  contributions: Contribution[];
  onBack: () => void;
}

export function VisualTrasa({ eventTitle, contributions, onBack }: Props) {
  const { t, dateFnsLocale } = useI18n();
  const mapRef = useRef<MapRef>(null);
  const [activePoint, setActivePoint] = useState<TrasaPoint | null>(null);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const points = useMemo<TrasaPoint[]>(
    () =>
      contributions
        .filter((c) => c.location != null)
        .sort(
          (a, b) =>
            (a.verifiedEventDate ?? a.eventDate).getTime() -
            (b.verifiedEventDate ?? b.eventDate).getTime()
        )
        .map((c) => ({
          contribution: c,
          lng: c.location!.longitude,
          lat: c.location!.latitude,
        })),
    [contributions]
  );

  const center = useMemo(() => {
    if (points.length === 0) return { lng: 17.1, lat: 48.1 };
    return {
      lng: points.reduce((s, p) => s + p.lng, 0) / points.length,
      lat: points.reduce((s, p) => s + p.lat, 0) / points.length,
    };
  }, [points]);

  const routeGeoJson = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features:
        points.length >= 2
          ? [
              {
                type: "Feature" as const,
                properties: {},
                geometry: {
                  type: "LineString" as const,
                  coordinates: points.map((p) => [p.lng, p.lat]),
                },
              },
            ]
          : [],
    }),
    [points]
  );

  const handleMapLoad = useCallback(() => {
    if (points.length < 2 || !mapRef.current) return;
    const lngs = points.map((p) => p.lng);
    const lats = points.map((p) => p.lat);
    mapRef.current.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 64, maxZoom: 15, duration: 0 }
    );
  }, [points]);

  const playTrip = useCallback(async () => {
    if (playing || points.length === 0) return;
    setPlaying(true);
    playingRef.current = true;
    setActivePoint(null);

    for (const point of points) {
      if (!playingRef.current) break;
      setActivePoint(null);
      mapRef.current?.flyTo({
        center: [point.lng, point.lat],
        zoom: 15,
        duration: 2500,
        essential: true,
      });
      await new Promise<void>((r) => setTimeout(r, 3000));
      if (!playingRef.current) break;
      setActivePoint(point);
      await new Promise<void>((r) => setTimeout(r, 5000));
    }

    setActivePoint(null);
    playingRef.current = false;
    setPlaying(false);
  }, [playing, points]);

  const stopTrip = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    setActivePoint(null);
  }, []);

  if (!token) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh gap-4 px-6 text-center">
        <p className="text-sm text-ink-dim">
          Chýba Mapbox token. Nastavte{" "}
          <code className="text-xs bg-surface px-1 py-0.5 rounded">
            NEXT_PUBLIC_MAPBOX_TOKEN
          </code>{" "}
          v .env.local
        </p>
        <button onClick={onBack} className="text-sm text-gold hover:underline">
          {t.trasa.back}
        </button>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-dvh gap-3 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-surface flex items-center justify-center">
          <RouteIcon className="h-7 w-7 text-ink-subtle" />
        </div>
        <p className="text-sm font-semibold text-ink">{eventTitle}</p>
        <p className="text-sm text-ink-dim">{t.trasa.noGpsDesc}</p>
        <button onClick={onBack} className="text-sm text-gold hover:underline">
          {t.trasa.back}
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-dvh overflow-hidden bg-surface">
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={{ longitude: center.lng, latitude: center.lat, zoom: 11 }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/outdoors-v12"
        onLoad={handleMapLoad}
      >
        {/* Route polyline */}
        <Source id="route" type="geojson" data={routeGeoJson}>
          <Layer
            id="route-shadow"
            type="line"
            paint={{ "line-color": "#000000", "line-width": 6, "line-opacity": 0.1 }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
          <Layer
            id="route-line"
            type="line"
            paint={{ "line-color": "#D4A843", "line-width": 3.5, "line-opacity": 0.95 }}
            layout={{ "line-cap": "round", "line-join": "round" }}
          />
        </Source>

        {/* Contribution markers */}
        {points.map((point, idx) => {
          const c = point.contribution;
          const firstPhoto = [...c.chroniclerPhotoUrls, ...c.photoUrls][0] ?? null;
          const isActive = activePoint?.contribution.id === c.id;
          return (
            <Marker
              key={c.id}
              longitude={point.lng}
              latitude={point.lat}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setActivePoint(isActive ? null : point);
              }}
            >
              <TrasaMarkerPin index={idx + 1} photoUrl={firstPhoto} isActive={isActive} />
            </Marker>
          );
        })}
      </Map>

      {/* Top gradient bar */}
      <div className="absolute top-0 inset-x-0 px-4 pt-4 pb-8 flex items-center gap-3 bg-gradient-to-b from-black/55 via-black/20 to-transparent pointer-events-none">
        <button
          onClick={onBack}
          className="pointer-events-auto shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-white/90 backdrop-blur shadow-md text-neutral-800"
          aria-label={t.trasa.back}
        >
          <BackIcon />
        </button>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white drop-shadow-sm truncate">{eventTitle}</p>
          <p className="text-xs text-white/80">{t.trasa.stopCount(points.length)}</p>
        </div>
      </div>

      {/* Play / Stop button */}
      <div className="absolute bottom-8 inset-x-0 flex justify-center px-4">
        {playing ? (
          <button
            onClick={stopTrip}
            className="flex items-center gap-2 px-7 py-3.5 rounded-full bg-white/95 backdrop-blur shadow-xl text-sm font-semibold text-neutral-800"
          >
            <PauseIcon />
            {t.trasa.pause}
          </button>
        ) : (
          <button
            onClick={playTrip}
            className="flex items-center gap-2 px-7 py-3.5 rounded-full shadow-xl text-sm font-semibold text-white"
            style={{ backgroundColor: "#D4A843" }}
          >
            <PlayIcon />
            {t.trasa.play}
          </button>
        )}
      </div>

      {/* Media panel */}
      {activePoint && (
        <MediaPanel
          point={activePoint}
          dateFnsLocale={dateFnsLocale}
          onClose={() => setActivePoint(null)}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TrasaMarkerPin({
  index,
  photoUrl,
  isActive,
}: {
  index: number;
  photoUrl: string | null;
  isActive: boolean;
}) {
  return (
    <div
      className={`relative cursor-pointer transition-transform ${isActive ? "scale-125" : "hover:scale-110"}`}
      style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.35))" }}
    >
      <div
        className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center`}
        style={{
          border: `2.5px solid ${isActive ? "#D4A843" : "white"}`,
          ...(photoUrl
            ? { backgroundImage: `url(${photoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { backgroundColor: isActive ? "#D4A843" : "white" }),
        }}
      >
        {!photoUrl && (
          <span
            className="text-xs font-bold leading-none"
            style={{ color: isActive ? "white" : "#D4A843" }}
          >
            {index}
          </span>
        )}
      </div>
      {/* Pin tail */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: -7,
          width: 0,
          height: 0,
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: `8px solid ${isActive ? "#D4A843" : "white"}`,
        }}
      />
    </div>
  );
}

function MediaPanel({
  point,
  dateFnsLocale,
  onClose,
}: {
  point: TrasaPoint;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dateFnsLocale: any;
  onClose: () => void;
}) {
  const c = point.contribution;
  const photos = [...c.chroniclerPhotoUrls, ...c.photoUrls];
  const firstVoice = c.voices[0] ?? null;
  const firstText = c.texts[0] ?? c.chroniclerText ?? null;

  return (
    <div className="absolute inset-x-3 bottom-24 rounded-2xl bg-surface/97 backdrop-blur-md shadow-2xl overflow-hidden border border-rim">
      {photos.length > 0 && (
        <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[0]}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          {photos.length > 1 && (
            <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
              +{photos.length - 1}
            </span>
          )}
        </div>
      )}
      {photos.length === 0 && c.videoUrls.length > 0 && (
        <video src={c.videoUrls[0]} controls className="w-full" style={{ maxHeight: 200 }} />
      )}
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink truncate">{c.contributorName}</p>
            <p className="text-xs text-ink-subtle">
              {format(c.verifiedEventDate ?? c.eventDate, "d. MMMM yyyy", {
                locale: dateFnsLocale,
              })}
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 text-ink-subtle hover:text-ink">
            <CloseIcon />
          </button>
        </div>
        {firstText && (
          <p className="text-sm text-ink leading-relaxed line-clamp-3">{firstText}</p>
        )}
        {firstVoice && (
          <audio src={firstVoice.url} controls className="w-full h-8" />
        )}
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
      <path d="M5 3l14 9-14 9V3z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function RouteIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? "h-5 w-5"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M3 10h11a4 4 0 0 1 0 8h-1M3 10l4-4M3 10l4 4" />
      <circle cx="19" cy="6" r="2" />
    </svg>
  );
}

"use client";

import { useState, useCallback } from "react";
import type { GeoLocation } from "@/types/contribution";

export type LocationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: GeoLocation }
  | { status: "denied" }
  | { status: "error"; message: string };

export function useLocation() {
  const [state, setState] = useState<LocationState>({ status: "idle" });

  const capture = useCallback(() => {
    if (!navigator.geolocation) {
      setState({ status: "error", message: "Geolokácia nie je podporovaná" });
      return;
    }
    setState({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          status: "ok",
          data: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          },
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState({ status: "denied" });
        } else {
          setState({ status: "error", message: err.message });
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, capture, reset };
}

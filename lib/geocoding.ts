/**
 * Reverse-geocodes GPS coordinates to a human-readable location name
 * using the Nominatim OpenStreetMap API.
 *
 * Returns a short string like "Hlavná ulica, Bratislava" or null on failure.
 */
export async function getLocationName(lat: number, lon: number): Promise<string | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        // Nominatim ToS require a valid User-Agent identifying the app and contact
        "User-Agent": "PrasaApp/1.0 (+sivacikapp@gmail.com)",
        "Accept-Language": "sk,cs;q=0.8,en;q=0.5",
      },
    });

    if (!res.ok) return null;
    const data = await res.json() as {
      address?: Record<string, string>;
      display_name?: string;
    };

    const addr = data.address;
    if (!addr) return data.display_name ?? null;

    const road = addr.road ?? addr.pedestrian ?? addr.footway ?? addr.path ?? null;
    const place =
      addr.city ??
      addr.town ??
      addr.village ??
      addr.hamlet ??
      addr.suburb ??
      addr.county ??
      null;

    if (road && place) return `${road}, ${place}`;
    if (place) return place;
    if (road) return road;
    return data.display_name ?? null;
  } catch {
    return null;
  }
}

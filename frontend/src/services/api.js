/**
 * SPHEREx Time-Domain Explorer - API Service Layer
 * Strict connection to FastAPI backend at http://localhost:8000
 * ZERO MOCKS / ZERO SIMULATION POLICY
 */

export const API_BASE_URL = 'http://localhost:8000';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Health check: GET /health -> {"status":"ok"}
 */
export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      // timeout short to fail fast if backend is down
    });
    if (!res.ok) {
      throw new ApiError(`Health check failed with status ${res.status}`, res.status);
    }
    const data = await res.json();
    return data && (data.status === 'ok' || data.status === 'healthy' || data.status === 'success');
  } catch (err) {
    console.error('[SPHEREx API] Health check error:', err);
    return false;
  }
}

/**
 * VIP Targets catalog: GET /api/targets with fallback to GET /targets
 */
export async function getTargets() {
  let res;
  try {
    res = await fetch(`${API_BASE_URL}/api/targets`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) {
      // Fallback
      res = await fetch(`${API_BASE_URL}/targets`, {
        headers: { 'Accept': 'application/json' }
      });
    }
  } catch (err) {
    // Retry fallback if first one had network error
    res = await fetch(`${API_BASE_URL}/targets`, {
      headers: { 'Accept': 'application/json' }
    });
  }

  if (!res.ok) {
    throw new ApiError(`Failed to fetch targets catalog (${res.status})`, res.status);
  }

  const data = await res.json();
  return data;
}

/**
 * FITS Manifest for VIP Target: GET /fits/{tid}
 */
export async function getFitsManifest(tid) {
  if (!tid) throw new Error('Target ID (tid) is required');
  const res = await fetch(`${API_BASE_URL}/fits/${encodeURIComponent(tid)}`, {
    headers: { 'Accept': 'application/json' }
  });
  if (!res.ok) {
    throw new ApiError(`Failed to get FITS manifest for ${tid} (${res.status})`, res.status);
  }
  return await res.json();
}

/**
 * Epoch real PNG image URL: GET /fits/{tid}/{index}?format=png
 */
export function getEpochImageUrl(tid, index) {
  return `${API_BASE_URL}/fits/${encodeURIComponent(tid)}/${index}?format=png`;
}

/**
 * Ingest IRSA cutouts: POST /ingest/{tid}
 */
export async function ingestTarget(tid, { detector = 1, max_epocas = 10, ra = null, dec = null } = {}) {
  const targetId = tid || 'sky';
  const params = new URLSearchParams();
  if (detector !== null && detector !== undefined && detector !== 'ALL' && Number(detector) > 0) {
    params.set('detector', String(detector));
  }
  if (max_epocas !== null && max_epocas !== undefined) {
    params.set('max_epocas', String(max_epocas));
  }
  if (ra !== null && ra !== undefined) {
    params.set('ra', String(ra));
  }
  if (dec !== null && dec !== undefined) {
    params.set('dec', String(dec));
  }
  const query = params.toString() ? `?${params.toString()}` : '';

  const res = await fetch(`${API_BASE_URL}/ingest/${encodeURIComponent(targetId)}${query}`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new ApiError(`Ingest failed for ${tid}: ${errorText || res.statusText}`, res.status);
  }
  return await res.json();
}

/**
 * Difference Mode (NumPy Subtraction): GET /diff/{tid}?a={a}&b={b}&detector={detector}&sigma={sigma}
 */
export async function getDifference(tid, { a = 0, b = 1, detector = 1, sigma = 3, ra = null, dec = null } = {}) {
  const targetId = tid || 'sky';
  const params = new URLSearchParams({
    a: String(a),
    b: String(b),
    detector: String(detector),
    sigma: String(sigma)
  });
  if (ra !== null && ra !== undefined) params.set('ra', String(ra));
  if (dec !== null && dec !== undefined) params.set('dec', String(dec));

  const url = `${API_BASE_URL}/diff/${encodeURIComponent(targetId)}?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new ApiError(`Failed to compute difference for ${tid} (${res.status})`, res.status);
  }

  // Check if response is an image or JSON
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('image/')) {
    const blob = await res.blob();
    return {
      type: 'blob',
      imageUrl: URL.createObjectURL(blob),
      blob
    };
  } else {
    const json = await res.json();
    const base64Img = json.image_url ||
      (json.png_base64 ? (json.png_base64.startsWith('data:') ? json.png_base64 : `data:image/png;base64,${json.png_base64}`) : null) ||
      (json.frame ? (json.frame.startsWith('data:') ? json.frame : `data:image/png;base64,${json.frame}`) : null);

    return {
      type: 'json',
      data: json,
      imageUrl: base64Img
    };
  }
}

/**
 * 102-channel infrared spectrum: GET /spectrum/{tid}?x={x}&y={y}&index={index}&ra={ra}&dec={dec}
 */
export async function getSpectrum(tid, { x, y, index, ra, dec } = {}) {
  const params = new URLSearchParams();
  if (x !== undefined && x !== null) params.set('x', String(Math.round(x)));
  if (y !== undefined && y !== null) params.set('y', String(Math.round(y)));
  if (index !== undefined && index !== null) params.set('index', String(index));
  if (ra !== undefined && ra !== null) params.set('ra', String(ra));
  if (dec !== undefined && dec !== null) params.set('dec', String(dec));

  const query = params.toString() ? `?${params.toString()}` : '';
  const url = `${API_BASE_URL}/spectrum/${encodeURIComponent(tid)}${query}`;

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' }
  });
  if (!res.ok) {
    throw new ApiError(`Failed to fetch spectrum for ${tid} (${res.status})`, res.status);
  }
  return await res.json();
}

/**
 * Hybrid Engine & Dynamic Sky Exploration: POST /api/explorar
 * Payload: { "ra": float, "dec": float, "target_id": string | null, "mode": "normal" | "diff" }
 */
export async function exploreSky({ ra, dec, target_id = null, mode = 'normal' }) {
  const payload = {
    ra: parseFloat(ra),
    dec: parseFloat(dec),
    target_id: target_id || null,
    mode: mode === 'diff' ? 'diff' : 'normal'
  };

  const res = await fetch(`${API_BASE_URL}/api/explorar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(6000)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new ApiError(`Dynamic sky exploration failed (${res.status}): ${errText}`, res.status);
  }
  return await res.json();
}

/**
 * Cross-validation with Gaia DR3: GET /gaia-check
 * Query params: ?target={tid}&radius={r} or ?ra={ra}&dec={dec}&radius={r}
 */
export async function checkGaia({ target, ra, dec, radius = 5 } = {}) {
  const params = new URLSearchParams();
  if (target) {
    params.set('target', target);
  }
  if (ra !== undefined && ra !== null) {
    params.set('ra', String(ra));
  }
  if (dec !== undefined && dec !== null) {
    params.set('dec', String(dec));
  }
  params.set('radius', String(radius));

  const res = await fetch(`${API_BASE_URL}/gaia-check?${params.toString()}`, {
    headers: { 'Accept': 'application/json' }
  });

  if (!res.ok) {
    throw new ApiError(`Gaia DR3 check failed (${res.status})`, res.status);
  }
  return await res.json();
}

/**
 * Scientific MP4 Export: GET /export-mp4?target={tid}&mode={mode}&fps={fps}
 * Returns blob and triggers browser download
 */
export async function exportAndDownloadMp4({ target, mode = 'normal', fps = 5, ra = null, dec = null } = {}) {
  if (!target) throw new Error('Target identifier is required for video export');
  const params = new URLSearchParams({
    target,
    mode,
    fps: String(fps)
  });
  if (ra !== null && ra !== undefined) params.set('ra', String(ra));
  if (dec !== null && dec !== undefined) params.set('dec', String(dec));

  const url = `${API_BASE_URL}/export-mp4?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new ApiError(`Failed to export MP4 video (${res.status}): ${errorText || res.statusText}`, res.status);
  }

  const blob = await res.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `spherex_${target}_${mode}_${fps}fps.mp4`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 10000);
  return true;
}

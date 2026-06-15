import type {
  Template, Session, AnalysisJob, Programme, CommandResult, HistoryEntry, LayoutData,
} from './types';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Library ─────────────────────────────────────────────────────────────────
export const library = {
  list(params?: { typology?: string; validated?: boolean }): Promise<Template[]> {
    const q = params ? new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
    ).toString() : '';
    return req(`/library/templates${q ? `?${q}` : ''}`);
  },
  match(typology: string, surface?: number): Promise<Template[]> {
    const q = new URLSearchParams({ typology, ...(surface ? { surface_totale: String(surface) } : {}) }).toString();
    return req(`/library/templates/match?${q}`);
  },
  get(id: string): Promise<Template> {
    return req(`/library/templates/${id}`);
  },
  delete(id: string): Promise<void> {
    return req(`/library/templates/${id}`, { method: 'DELETE' });
  },
};

// ── Analysis ────────────────────────────────────────────────────────────────
export const analysis = {
  start(data: {
    images: string[];
    typology?: string;
    save_as_template?: boolean;
    template_nom?: string;
  }): Promise<{ id: string; status: string }> {
    const images = data.images.map(img =>
      typeof img === 'string' ? { data: img, media_type: 'image/jpeg' } : img
    );
    return req('/analyze-plans', { method: 'POST', body: JSON.stringify({ ...data, images }) });
  },
  status(id: string): Promise<AnalysisJob> {
    return req(`/analyze-plans/${id}`);
  },
  programme(id: string): Promise<{ programme: Programme; confiance: number }> {
    return req(`/analyze-plans/${id}/programme`);
  },
};

// ── Sessions ─────────────────────────────────────────────────────────────────
export const sessions = {
  create(data: {
    project_name: string;
    cdc_texte?: string;
    user_id?: string;
    location?: { lat: number; lng: number };
    emprise?: { largeur: number; profondeur: number };
    plu?: Record<string, string | number>;
    adresse?: string;
  }): Promise<Session> {
    return req('/sessions', { method: 'POST', body: JSON.stringify(data) });
  },
  list(userId?: string): Promise<Session[]> {
    return req(`/sessions${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`);
  },
  get(id: string): Promise<Session & { history: HistoryEntry[] }> {
    return req(`/sessions/${id}`);
  },
  command(id: string, command: string): Promise<CommandResult> {
    return req(`/sessions/${id}/command`, {
      method: 'POST',
      body: JSON.stringify({ command }),
    });
  },
  lock(id: string): Promise<Session> {
    return req(`/sessions/${id}/lock`, { method: 'POST' });
  },
  generate(id: string, styleRefs?: Record<string, unknown>): Promise<{ job_id: string }> {
    return req(`/sessions/${id}/generate`, {
      method: 'POST',
      body: JSON.stringify(styleRefs ? { style_refs: styleRefs } : {}),
    });
  },
  layout(id: string): Promise<LayoutData> {
    return req(`/sessions/${id}/layout`);
  },
  svg(id: string): Promise<{ svg: string }> {
    return req(`/sessions/${id}/svg`);
  },
};

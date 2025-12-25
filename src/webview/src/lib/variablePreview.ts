export interface VariablePreviewResult {
  resolved: string;
  missing: string[];
  dynamic: string[];
  used: string[];
  hasTemplate: boolean;
}

export function buildPreviewVariables(
  snapshot: {
    environments: Array<{ name: string; variables: Record<string, string> }>;
    active: string[];
    runtime: Record<string, string>;
  } | null,
  activeEnvironments: string[] = []
): Record<string, string> {
  if (!snapshot) {
    return {};
  }
  const activeName = activeEnvironments[0] || snapshot.active[0];
  const envVariables =
    snapshot.environments.find(env => env.name === activeName)?.variables || {};
  return {
    ...envVariables,
    ...snapshot.runtime,
  };
}

export function resolveTemplatePreview(
  text: string,
  variables: Record<string, string>
): VariablePreviewResult {
  if (!text) {
    return {
      resolved: '',
      missing: [],
      dynamic: [],
      used: [],
      hasTemplate: false,
    };
  }
  const missing = new Set<string>();
  const dynamic = new Set<string>();
  const used = new Set<string>();
  let hasTemplate = false;
  const resolved = text.replace(/\{\{\s*([^{}]+?)\s*\}\}/gu, (raw, name) => {
    const key = name.trim();
    if (!key) {
      return raw;
    }
    hasTemplate = true;
    used.add(key);
    if (key.startsWith('$')) {
      dynamic.add(key);
      return raw;
    }
    const value = variables[key];
    if (value === undefined || value === null) {
      missing.add(key);
      return raw;
    }
    return value;
  });
  return {
    resolved,
    missing: Array.from(missing),
    dynamic: Array.from(dynamic),
    used: Array.from(used),
    hasTemplate,
  };
}

export function truncatePreview(text: string, limit = 4000): { text: string; truncated: boolean } {
  if (text.length <= limit) {
    return { text, truncated: false };
  }
  return { text: `${text.slice(0, limit)}…`, truncated: true };
}

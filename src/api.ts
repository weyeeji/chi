const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function headers(adminToken?: string) {
  const result: Record<string, string> = {};
  if (adminToken) result["x-admin-token"] = adminToken;
  return result;
}

export async function apiGet<T>(path: string, adminToken?: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: headers(adminToken)
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export async function apiSend<T>(path: string, method: "POST" | "PATCH", body: unknown, adminToken?: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers(adminToken) },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export async function downloadAdminFile(path: string, filename: string, adminToken: string) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: headers(adminToken)
  });
  if (!response.ok) throw new Error(await response.text());
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

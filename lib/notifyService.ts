import { getAuthHeaders } from "@/lib/authHeaders";

export async function notifyChroniclers(contributorName: string, eventDate: Date): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        type: "newContribution",
        contributorName,
        eventDate: eventDate.toLocaleDateString("sk-SK"),
      }),
    });
  } catch {
    // notification failure must not block contribution saving
  }
}

export async function notifyAdmins(userName: string, userEmail: string): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ type: "newUser", userName, userEmail }),
    });
  } catch {
    // notification failure must not block user creation
  }
}

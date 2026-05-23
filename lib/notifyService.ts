export async function notifyChroniclers(contributorName: string, eventDate: Date): Promise<void> {
  try {
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "newUser", userName, userEmail }),
    });
  } catch {
    // notification failure must not block user creation
  }
}

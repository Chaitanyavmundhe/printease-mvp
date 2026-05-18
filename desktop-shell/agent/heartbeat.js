// Future phase: connect this to the Render backend agent heartbeat endpoint.
// Do not start background loops automatically in this desktop shell phase.

export async function sendHeartbeat() {
  return {
    success: false,
    message: "Heartbeat will be connected in a later phase.",
  };
}

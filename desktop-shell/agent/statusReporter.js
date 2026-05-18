// Future phase: report desktop/printer status to the Render backend.
// Keep this passive until a hub explicitly pairs the desktop app.

export async function reportStatus() {
  return {
    success: false,
    message: "Status reporting will be connected in a later phase.",
  };
}

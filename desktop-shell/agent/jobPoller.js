// Future phase: fetch paid print jobs from the Render backend.
// This phase only exposes local printer controls; no polling starts automatically.

export async function pollJobs() {
  return {
    success: false,
    message: "Job polling will be connected in a later phase.",
  };
}

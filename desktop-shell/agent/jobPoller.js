const { createHash } = require("node:crypto");
const { createWriteStream } = require("node:fs");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");
const { backendRequest } = require("./heartbeat.js");
const { printFile } = require("../printer/printExecutor.js");

async function getNextJob({ agentToken } = {}) {
  if (!agentToken) {
    return {
      success: false,
      error: "Agent token is required before polling jobs.",
    };
  }

  return backendRequest({
    endpoint: "/api/agents/jobs/next",
    agentToken,
  });
}

async function markJobStatus({ agentToken, jobId, status, reasonCode, reasonText } = {}) {
  if (!agentToken || !jobId || !status) {
    return {
      success: false,
      error: "Agent token, job id, and status are required before updating a job.",
    };
  }

  const endpointByStatus = {
    accepted: "accepted",
    downloading: "downloading",
    printing: "printing",
    completed: "completed",
    failed: "failed",
  };

  const action = endpointByStatus[status];
  if (!action) {
    return {
      success: false,
      error: `Unsupported job status: ${status}`,
    };
  }

  return backendRequest({
    endpoint: `/api/agents/jobs/${encodeURIComponent(jobId)}/${action}`,
    method: "POST",
    agentToken,
    body: {
      reasonCode,
      reasonText,
    },
  });
}

function getJobExtension(job) {
  if (job?.fileType === "application/pdf") return ".pdf";
  return ".bin";
}

async function calculateSha256(filePath) {
  const buffer = await readFile(filePath);
  return createHash("sha256").update(buffer).digest("hex");
}

async function downloadJobFile(job) {
  if (!job?.fileUrl) {
    return {
      success: false,
      error: "Print job did not include a file URL.",
    };
  }

  const response = await fetch(job.fileUrl);
  if (!response.ok || !response.body) {
    return {
      success: false,
      error: `Could not download print file. Status ${response.status}.`,
    };
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "printease-job-"));
  const filePath = path.join(tempDir, `${job.jobId || "job"}${getJobExtension(job)}`);

  try {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(filePath));

    if (job.fileSha256 || job.fileHash) {
      const expectedHash = job.fileSha256 || job.fileHash;
      const actualHash = await calculateSha256(filePath);

      if (actualHash !== expectedHash) {
        await rm(tempDir, { recursive: true, force: true }).catch(() => {});
        return {
          success: false,
          error: "Downloaded print file failed SHA-256 verification.",
        };
      }
    }

    return {
      success: true,
      filePath,
      tempDir,
    };
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    return {
      success: false,
      error: error.message || "Could not save downloaded print file.",
    };
  }
}

async function processNextJob({ agentToken, printerName } = {}) {
  const nextJob = await getNextJob({ agentToken });
  if (!nextJob?.success || !nextJob.job) return nextJob;

  const job = nextJob.job;
  const selectedPrinter = printerName || job.printerName;
  let download = null;

  try {
    await markJobStatus({ agentToken, jobId: job.jobId, status: "accepted" });
    await markJobStatus({ agentToken, jobId: job.jobId, status: "downloading" });

    download = await downloadJobFile(job);
    if (!download.success) throw new Error(download.error);

    await markJobStatus({ agentToken, jobId: job.jobId, status: "printing" });
    const printResult = await printFile({
      printerName: selectedPrinter,
      filePath: download.filePath,
      copies: job.copies || 1,
    });

    if (!printResult.success) throw new Error(printResult.error || "Print command failed.");

    await markJobStatus({ agentToken, jobId: job.jobId, status: "completed" });

    return {
      success: true,
      job,
      printResult,
    };
  } catch (error) {
    await markJobStatus({
      agentToken,
      jobId: job.jobId,
      status: "failed",
      reasonCode: "LOCAL_PRINT_FAILED",
      reasonText: error.message || "Local desktop print failed.",
    }).catch(() => {});

    return {
      success: false,
      error: error.message || "Could not process print job.",
      job,
    };
  } finally {
    if (download?.tempDir) {
      await rm(download.tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

function createJobPoller() {
  let timer = null;

  return {
    get isRunning() {
      return Boolean(timer);
    },
    async pollOnce(options = {}) {
      return processNextJob(options);
    },
    start(options = {}) {
      if (timer) {
        return {
          success: true,
          message: "Job polling is already running.",
        };
      }

      const intervalMs = Math.max(3000, Number(options.intervalMs) || 5000);
      timer = setInterval(() => {
        processNextJob(options).catch(() => {});
      }, intervalMs);

      return {
        success: true,
        message: "Job polling started.",
      };
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }

      return {
        success: true,
        message: "Job polling stopped.",
      };
    },
  };
}

module.exports = {
  createJobPoller,
  downloadJobFile,
  getNextJob,
  markJobStatus,
  processNextJob,
};

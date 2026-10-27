function capacity(setting) {
  const value = Number(process.env[setting]);
  return Number.isInteger(value) && value > 0 ? Math.min(value, 4) : 1;
}

export function createUploadCapacity(setting = 'MAX_CONCURRENT_UPLOADS') {
  let active = 0;
  return (parser, handler) => (req, res, next) => {
    if (active >= capacity(setting)) {
      res.setHeader('Retry-After', '3');
      return res.status(503).json({ success: false, code: 'UPLOAD_CAPACITY_BUSY', message: 'Document processing is busy. Please retry shortly.' });
    }
    active++;
    let processing = false;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active--;
      req.off('aborted', onAborted);
    };
    // A disconnect must not free capacity while a controller is still parsing
    // PDFs or writing to storage. Hold the permit until its promise settles.
    const onAborted = () => { if (!processing) release(); };
    req.once('aborted', onAborted);
    const fail = error => { release(); next(error); };
    try {
      parser(req, res, error => {
        if (error) return fail(error);
        if (released || req.aborted) return release();
        processing = true;
        Promise.resolve().then(() => handler(req, res, fail)).catch(fail).finally(release);
      });
    } catch (error) {
      fail(error);
    }
  };
}

// Separate budgets: customer uploads cannot consume the conversion delivery
// slot needed by a paired desktop to return a verified PDF and finish billing.
export const withUploadCapacity = createUploadCapacity();
export const withAgentUploadCapacity = createUploadCapacity('MAX_CONCURRENT_AGENT_UPLOADS');

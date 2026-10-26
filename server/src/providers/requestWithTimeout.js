const { getSignal, throwIfCancelled } = require('../services/jobContext');
const requestWithTimeout = async (request, timeoutMs, providerName) => {
  throwIfCancelled();
  const controller = new AbortController(), parent = getSignal();
  const cancel = () => controller.abort();
  parent?.addEventListener('abort', cancel, { once: true });
  const timer = setTimeout(cancel, timeoutMs);
  try { return await request(controller.signal); }
  catch (error) {
    throwIfCancelled();
    if (controller.signal.aborted) throw new Error(providerName + ' request timed out after ' + timeoutMs + 'ms');
    throw error;
  } finally { clearTimeout(timer); parent?.removeEventListener('abort', cancel); }
};
module.exports = { requestWithTimeout };

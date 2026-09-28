type Task = { name: string; run: () => Promise<unknown> };
type Report = (name: string) => void;

export async function runWorkerCycle(tasks: Task[], report: Report) {
  for (const task of tasks) {
    try { await task.run(); } catch { report(task.name); }
  }
}

/** One cycle at a time; shutdown waits for the outstanding durable writes. */
export function startWorker(tasks: Task[], intervalMs = 60_000, report: Report = (name) => {
  console.error(`${name} processing failed; it will retry on the next run.`);
}) {
  let pending: Promise<void> | undefined;
  const timer = setInterval(() => {
    if (pending) return;
    pending = runWorkerCycle(tasks, report).finally(() => { pending = undefined; });
  }, intervalMs);
  timer.unref();
  return {
    async stop() {
      clearInterval(timer);
      await pending;
    },
  };
}

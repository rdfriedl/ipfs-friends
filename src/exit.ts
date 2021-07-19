type Listener = () => Promise<void> | void;

const listeners = new Set<Listener>();
let isCalled = false;
let isRegistered = false;

async function exit(exit: boolean, signal: number) {
	if (isCalled) {
		return;
	}
	isCalled = true;

	for (const fn of listeners) {
		await fn();
	}

	if (exit === true) {
		process.exit(128 + signal); // eslint-disable-line unicorn/no-process-exit
	}
}

export const addShutdownListener = (fn: Listener) => {
	listeners.add(fn);

	if (!isRegistered) {
		isRegistered = true;

		process.once("exit", exit);
		process.once("SIGINT", exit.bind(null, true, 2));
		process.once("SIGTERM", exit.bind(null, true, 15));

		// PM2 Cluster shutdown message. Caught to support async handlers with pm2, needed because
		// explicitly calling process.exit() doesn't trigger the beforeExit event, and the exit
		// event cannot support async handlers, since the event loop is never called after it.
		process.on("message", (message) => {
			if (message === "shutdown") {
				exit(true, -128);
			}
		});
	}

	return () => {
		listeners.delete(fn);
	};
};

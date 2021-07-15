import OrbitDB from "orbit-db";
import { getIpfs } from "./ipfs";

let orbitdb;
export async function getOrbit() {
	if (!orbitdb) {
		const ipfs = await getIpfs();
		orbitdb = await OrbitDB.createInstance(ipfs);
	}

	return orbitdb;
}

let log;
export async function getLog() {
	const orbit = await getOrbit();

	if (!log) {
		log = await orbit.log("simple-log");

		await log.load();
	}

	return log;
}

export function closeAll() {
	if (log) {
		log.close();
	}
}

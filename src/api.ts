import fetch from "node-fetch";
import { apiRange, apiUrl } from "./const";
import semver from "semver";

export async function getVersion() {
	const url = new URL("/version", apiUrl);
	const versionString = await fetch(url.toString()).then((res) => res.text());
	if (semver.valid(versionString)) {
		return versionString;
	}
}

export async function checkVersion() {
	const version = await getVersion();
	if (version) {
		if (!semver.satisfies(version, apiRange)) {
			throw new Error(`Incompatible api version, wanted ${apiRange} but got ${version}`);
		}
	}
}

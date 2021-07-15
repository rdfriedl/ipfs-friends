import path from "path";
import { IPFS } from "ipfs-core-types";
import { create as createLocal } from "ipfs-core";
import { create as createRemote } from "ipfs-http-client";
import { ipfsApiUrl, ipfsMode, ipfsRepoPath } from "./const";

const ipfsPath = path.isAbsolute(ipfsRepoPath) ? ipfsRepoPath : path.resolve(process.cwd(), ipfsRepoPath);
let ipfsClient: IPFS;

async function createClient() {
	if (ipfsMode === "remote") {
		console.log(`connecting to ${ipfsApiUrl}`);

		return createRemote({
			url: ipfsApiUrl,
		});
	} else {
		console.log(`creating ipfs node`);
		return await createLocal({
			repo: ipfsPath,
			EXPERIMENTAL: {
				ipnsPubsub: true,
			},
		});
	}
}

export async function getIpfs() {
	if (!ipfsClient) {
		ipfsClient = await createClient();
	}

	return ipfsClient;
}

export async function readFile(ipfsPath: string) {
	const ipfs = await getIpfs();
	const read = ipfs.files.read(ipfsPath);
	let file = "";
	for await (const chunk of read) {
		file += chunk.toString();
	}
	return file;
}
export async function writeFile(ipfsPath: string, content: Parameters<IPFS["files"]["write"]>[1]) {
	const ipfs = await getIpfs();
	await ipfs.files.write(ipfsPath, content);
}

export function stop() {
	if (ipfsClient) {
		ipfsClient.stop();
	}
}

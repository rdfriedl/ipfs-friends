import path from "path";
import { IPFS, create } from "ipfs-core";

const ipfsPath = path.resolve(process.cwd(), "data/ipfs");
let ipfsClient: IPFS;

export async function getIpfs() {
	if (!ipfsClient) {
		console.log("Creating ipfs client");
		ipfsClient = await create({
			repo: ipfsPath,
		});
	}

	return ipfsClient;
}

export function stop() {
	if (ipfsClient) {
		ipfsClient.stop();
	}
}

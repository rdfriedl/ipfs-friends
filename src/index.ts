import { CID } from "ipfs-core";
import path from "path";
import fs from "fs";
import { createMessage, encrypt } from "openpgp";
import { fetchFileBackups, updateFileBackups } from "./private-api";
import { photoFolderPath } from "./const";
import { checkVersion } from "./api";
import { getIpfs, stop } from "./ipfs";
import { getPrivateKey, getPublicKey } from "./keys";
import { getFileHash } from "./files";

async function backupFiles() {
	const ipfs = await getIpfs();
	const fileBackups = await fetchFileBackups();
	let newFileBackups = Array.from(fileBackups);

	const folderPath = path.resolve(photoFolderPath);
	const files = await fs.promises.readdir(folderPath);

	for (const filename of files) {
		const filePath = path.resolve(folderPath, filename);
		const stat = await fs.promises.stat(filePath);

		if (!stat.isDirectory()) {
			const fileHash = await getFileHash(filePath);
			const backup = newFileBackups.find((b) => b.path === filename);

			if (backup && backup.fileHash !== fileHash) {
				console.log(`Removing old file ${filePath}, old: ${backup.fileHash} new: ${fileHash}`);
				newFileBackups = newFileBackups.filter((b) => b.fileHash !== backup.fileHash);
				await ipfs.pin.rm(new CID(backup.ipfsHash));
			}

			if (!backup || backup.fileHash !== fileHash) {
				const message = await createMessage({
					filename,
					binary: fs.createReadStream(filePath),
				});
				const encrypted: unknown = await encrypt({
					message,
					encryptionKeys: await getPublicKey(),
					signingKeys: await getPrivateKey(),
					armor: false,
				});

				const { cid } = await ipfs.add(encrypted as ReadableStream<Uint8Array>);
				await ipfs.pin.add(cid);

				console.log(`added ${filename} to ipfs ${cid.toString()}`);
				newFileBackups.push({
					path: filename,
					ipfsHash: cid.toString(),
					fileHash: fileHash,
				});
			}
		}
	}

	await updateFileBackups(newFileBackups);

	setTimeout(() => backupFiles(), 10 * 1000);
}

async function main() {
	await checkVersion();

	// start ipfs client up
	await getIpfs();

	// start sync process
	setTimeout(() => backupFiles(), 10 * 1000);
}
main();

process.on("SIGINT", () => {
	console.info("stopping ipfs");
	stop();
	process.exit();
});

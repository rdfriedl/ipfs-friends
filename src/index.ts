import { CID } from "ipfs-core";
import path from "path";
import fs from "fs";
import { createMessage, encrypt, sign } from "openpgp";
import { fetchFileBackups, updateFileBackups } from "./private-api";
import { photoFolderPath } from "./const";
// import { checkVersion } from "./api";
import { getIpfs, stop } from "./ipfs";
import { getPrivateKey, getPublicKey } from "./keys";
import { getFileHash } from "./files";
// import { closeAll, getLog } from "./db";
import { syncDir } from "./sync";

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
	// await checkVersion();

	// start ipfs client up
	const ipfs = await getIpfs();
	// const log = await getLog();
	// console.log(log.address.toString());

	// log.events.on('replicated', (address: string) => console.log(address))

	// setInterval(() => {
	// 	log.add(`Random number: ${Math.floor(Math.random()*1000)}`)
	// }, 1000)

	// const email = await (await (await getPublicKey()).getPrimaryUser()).user.userID?.email;
	// if(email){
	// 	await ipfs.pubsub.subscribe(email, (msg) => {
	// 		console.log(msg.data.toString());
	// 	})
	// 	console.log(`subscribed to ${email}`);

	// 	setInterval(async () => {
	// 		const message = await createMessage({text: `random number ${Math.random()}`});
	// 		const signed = await sign({message, signingKeys: await getPrivateKey()})
	// 		await ipfs.pubsub.publish(`${email}/out`, Buffer.from(signed, 'utf-8'));
	// 	}, 5000);
	// }

	// start sync process
	// setTimeout(() => backupFiles(), 10 * 1000);
	syncDir(path.resolve(photoFolderPath), "/files");
}
main();

process.on("SIGINT", async () => {
	console.info("stopping ipfs");
	// await closeAll();
	await stop();
	process.exit();
});

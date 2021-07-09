import { CID, create as createIpfsNode, IPFS } from "ipfs-core";
import path from "path";
import fs from "fs";
import { PrivateKey, PublicKey, readKey, readPrivateKey, createMessage, encrypt } from "openpgp";
import crypto from "crypto";
import { fetchFileBackups, updateFileBackups } from "./private-api";
import { photoFolderPath } from "./const";

type Context = {
	publicKey: PublicKey;
	privateKey: PrivateKey;
	ipfs: IPFS;
};
const ipfsPath = path.resolve(process.cwd(), "data/ipfs");

async function main() {
	if (!process.env.PRIVATE_KEY_PATH) {
		throw new Error("PRIVATE_KEY_PATH must be set");
	}
	if (!process.env.PUBLIC_KEY_PATH) {
		throw new Error("PUBLIC_KEY_PATH must be set");
	}
	const armoredPrivateKey = await fs.promises.readFile(process.env.PRIVATE_KEY_PATH, { encoding: "utf-8" });
	const armoredPublicKey = await fs.promises.readFile(process.env.PRIVATE_KEY_PATH, { encoding: "utf-8" });
	const publicKey = await readKey({ armoredKey: armoredPublicKey });
	const privateKey = await readPrivateKey({ armoredKey: armoredPrivateKey });

	const ipfs = await createIpfsNode({
		repo: ipfsPath,
	});

	process.on("SIGINT", () => {
		console.info("stopping ipfs");
		ipfs.stop();
		process.exit();
	});

	const context: Context = { ipfs, publicKey, privateKey };

	setTimeout(() => backupFiles(context), 10 * 1000);
}

function getFileHash(filePath: string, type = "sha1"): Promise<string> {
	return new Promise((res, rej) => {
		const hash = crypto.createHash(type);
		hash.setEncoding("hex");
		fs.createReadStream(filePath).pipe(hash);
		hash.on("finish", () => {
			res(hash.read());
		});
	});
}

async function backupFiles({ ipfs, publicKey, privateKey }: Context) {
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
					encryptionKeys: publicKey,
					signingKeys: privateKey,
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

	setTimeout(() => backupFiles({ ipfs, publicKey, privateKey }), 10 * 1000);
}

main();

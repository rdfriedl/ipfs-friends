import path from "path";
import fs from "fs";
import { getIpfs, readFile as readIpfsFile } from "./ipfs";
import { getFileHash } from "./files";
import { createMessage, encrypt } from "openpgp";
import { getPrivateKey, getPublicKey } from "./keys";

const pfs = fs.promises;

export type FileBackup = {
	filename: string;
	fileHash: string;
};

async function readAsyncIterable(iterable: AsyncIterable<Uint8Array>) {
	const decoder = new TextDecoder("utf-8");
	let content = "";
	for await (const chunk of iterable) {
		content += decoder.decode(chunk, { stream: true });
	}
	return content;
}

async function getDirMetadata(ipfsPath: string) {
	const ipfs = await getIpfs();
	const metadataPath = path.join(ipfsPath, "metadata.json");

	let content;
	try {
		content = await readAsyncIterable(ipfs.files.read(metadataPath));
	} catch (e) {
		return [];
	}

	// try to parse
	try {
		return JSON.parse(content) as FileBackup[];
	}
	catch(e){
		console.log(`Failed to parse metadata.json at ${metadataPath}`);
		console.log(e);
		return [];
	}
}
async function updateDirMetadata(ipfsPath: string, metadata: FileBackup[]) {
	const ipfs = await getIpfs();
	await ipfs.files.write(path.join(ipfsPath, "metadata.json"), JSON.stringify(metadata, null, 2), {
		create: true,
		parents: true,
		truncate: true,
	});
}

type BufferReadableStream = NodeJS.ReadableStream & {
	[Symbol.asyncIterator](): AsyncIterableIterator<Buffer>;
};

export async function syncDir(folderPath: string, ipfsPath: string) {
	const ipfs = await getIpfs();
	const fileBackups = await getDirMetadata(ipfsPath);

	let newFileBackups = Array.from(fileBackups);

	const files = await pfs.readdir(folderPath, { withFileTypes: true });

	for (const dirent of files) {
		if (dirent.isFile()) {
			const filename = dirent.name;
			const filePath = path.resolve(folderPath, filename);
			const fileHash = await getFileHash(filePath);
			const backup = newFileBackups.find((b) => b.filename === filename);

			if (!backup || backup.fileHash !== fileHash) {
				console.log(`${filePath} changed writing to ipfs (old ${backup?.fileHash} new ${fileHash})`);

				const message = await createMessage({
					filename,
					binary: fs.createReadStream(filePath),
				});
				const encrypted = await encrypt({
					message,
					encryptionKeys: await getPublicKey(),
					signingKeys: await getPrivateKey(),
					armor: false,
				});

				await ipfs.files.write(path.resolve(ipfsPath, filename), encrypted as BufferReadableStream, {
					create: true,
					parents: true,
					truncate: true,
				});

				newFileBackups.push({
					filename,
					fileHash: fileHash,
				});

				await updateDirMetadata(ipfsPath, newFileBackups);
			}
		} else if (dirent.isDirectory()) {
			await syncDir(path.join(folderPath, dirent.name), path.join(ipfsPath, dirent.name));
		}
	}

	await updateDirMetadata(ipfsPath, newFileBackups);
}

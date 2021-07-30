import path from "path";
import fs from "fs";
import mime from 'mime-types';

import { getIpfs } from "./ipfs";
import { getFileHash } from "./files";
import { createMessage, encrypt } from "openpgp";
import { getPrivateKey, getPublicKey } from "./keys";
import { MFSEntry } from "ipfs-core-types/src/files";
import { readFolderMetadata, writeFolderMetadata } from "./device-state";
import { getHashOfString } from "./helpers/hash";

async function ipfsFilesList(ipfsPath: string) {
	const ipfs = await getIpfs();
	const reader = ipfs.files.ls(ipfsPath);
	const contents: MFSEntry[] = [];
	for await (const entery of reader) {
		contents.push(entery);
	}
	return contents;
}

type BufferReadableStream = NodeJS.ReadableStream & {
	[Symbol.asyncIterator](): AsyncIterableIterator<Buffer>;
};

const ignoreFiles = ["metadata"];
export async function syncLocalFolder(localPath: string, ipfsPath: string) {
	console.log(`syncing ${localPath} to ${ipfsPath}`);

	const ipfs = await getIpfs();
	const metadata = await readFolderMetadata(ipfsPath);

	const localFolderContents = await fs.promises.readdir(localPath, { withFileTypes: true });
	const ipfsFolderContents = await ipfsFilesList(ipfsPath);

	const localFiles = localFolderContents.filter((e) => e.isFile()).filter((f) => !ignoreFiles.includes(f.name));
	const ipfsFiles = ipfsFolderContents.filter((e) => e.type === "file").filter((f) => !ignoreFiles.includes(f.name));
	const filesTouched: string[] = [];
	const localFolders = localFolderContents.filter((e) => e.isDirectory());
	const ipfsFolders = ipfsFolderContents.filter((e) => e.type === "directory");
	const foldersTouched: string[] = [];

	// sync folders
	for (const localFolder of localFolders) {
		const hash = getHashOfString(localFolder.name);
		const folderLocalPath = path.join(localPath, localFolder.name);
		const folderIpfsPath = path.join(ipfsPath, hash);
		const meta = metadata.folders.find((f) => f.name === localFolder.name);

		if (!meta) {
			await ipfs.files.mkdir(folderIpfsPath, { parents: true });

			metadata.folders.push({
				name: localFolder.name,
				hash,
			});
		}
		foldersTouched.push(hash);
	}
	for (const ipfsFolder of ipfsFolders) {
		const originalFolderNameHash = ipfsFolder.name;
		if (!foldersTouched.includes(originalFolderNameHash)) {
			await ipfs.files.rm(path.join(ipfsPath, originalFolderNameHash), {recursive: true});
		}
	}

	// sync files
	while (localFiles.length > 0) {
		const localFile = localFiles.shift() as fs.Dirent;
		const fileLocalPath = path.join(localPath, localFile.name);
		const hash = await getFileHash(fileLocalPath);
		const fileIpfsPath = path.join(ipfsPath, hash);
		const meta = metadata.files.find((f) => f.filename === localFile.name);

		if (!meta || meta.fileHash !== hash) {
			const message = await createMessage({
				filename: localFile.name,
				binary: fs.createReadStream(fileLocalPath),
			});
			const encrypted = await encrypt({
				message,
				encryptionKeys: await getPublicKey(),
				signingKeys: await getPrivateKey(),
				armor: false,
			});

			await ipfs.files.write(fileIpfsPath, encrypted as BufferReadableStream, {
				create: true,
				truncate: true,
			});

			const ipfsHash = (await ipfs.files.stat(fileIpfsPath)).cid.toString();
			const mimeType = mime.lookup(localFile.name) || null;

			if (meta) {
				meta.filename = localFile.name;
				meta.fileHash = hash;
				meta.mimeType = mimeType;
				meta.ipfsHash = ipfsHash;
			} else {
				metadata.files.push({
					filename: localFile.name,
					fileHash: hash,
					mimeType,
					ipfsHash
				});
			}
		}

		filesTouched.push(hash);
	}
	for (const ipfsFile of ipfsFiles) {
		const originalFilenameHash = ipfsFile.name;
		if (!filesTouched.includes(originalFilenameHash)) {
			await ipfs.files.rm(path.join(ipfsPath, originalFilenameHash));
		}
	}

	await writeFolderMetadata(ipfsPath, metadata);

	for (const folder of metadata.folders) {
		await syncLocalFolder(path.join(localPath, folder.name), path.join(ipfsPath, folder.hash));
	}

	return metadata;
}

import path from "path";
import fs from "fs";
import mime from "mime-types";

import { getIpfs } from "./ipfs";
import { getFileHash } from "./files";
import { createMessage, encrypt } from "openpgp";
import { getPrivateKey, getPublicKey } from "./keys";
import { MFSEntry } from "ipfs-core-types/src/files";
import { FileBackup, FolderBackup, readFolderMetadata, writeFolderMetadata } from "./device-state";
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
	const localFolders = localFolderContents.filter((e) => e.isDirectory());
	const ipfsFolders = ipfsFolderContents.filter((e) => e.type === "directory");

	// sync folders
	const newFolders: FolderBackup[] = [];
	for (const localFolder of localFolders) {
		const hash = getHashOfString(localFolder.name);
		const folderLocalPath = path.join(localPath, localFolder.name);
		const folderIpfsPath = path.join(ipfsPath, hash);

		if (!ipfsFolders.find((f) => f.name === hash)) {
			await ipfs.files.mkdir(folderIpfsPath, { parents: true });
		}

		newFolders.push({
			name: localFolder.name,
			hash,
		});
	}
	const oldFolders = Array.from(metadata.folders);
	for (const folder of oldFolders) {
		if (!newFolders.find((f) => f.name === folder.name) && ipfsFolders.find(f => f.name === folder.hash)) {
			await ipfs.files.rm(path.join(ipfsPath, folder.hash), { recursive: true });
		}
	}

	metadata.folders = newFolders;

	const localFiles = localFolderContents.filter((e) => e.isFile()).filter((f) => !ignoreFiles.includes(f.name));
	const ipfsFiles = ipfsFolderContents.filter((e) => e.type === "file").filter((f) => !ignoreFiles.includes(f.name));

	// sync files
	const newFiles: FileBackup[] = [];
	while (localFiles.length > 0) {
		const localFile = localFiles.shift() as fs.Dirent;
		const fileLocalPath = path.join(localPath, localFile.name);
		const hash = await getFileHash(fileLocalPath);
		const fileIpfsPath = path.join(ipfsPath, hash);
		const meta = metadata.files.find((f) => f.filename === localFile.name);
		const ipfsFile = ipfsFiles.find((f) => f.name === hash);

		if (!meta || meta.fileHash !== hash || !ipfsFile) {
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
		}

		const ipfsHash = (await ipfs.files.stat(fileIpfsPath)).cid.toString();
		const mimeType = mime.lookup(localFile.name) || null;

		newFiles.push({
			filename: localFile.name,
			fileHash: hash,
			mimeType,
			ipfsHash,
		});
	}
	// remove deleted files
	const oldFiles = Array.from(metadata.files);
	for (const file of oldFiles) {
		if (!newFiles.find((f) => f.filename !== file.filename) && ipfsFiles.find(f => f.name === file.fileHash)) {
			await ipfs.files.rm(path.join(ipfsPath, file.fileHash));
		}
	}

	metadata.files = newFiles;

	await writeFolderMetadata(ipfsPath, metadata);

	for (const folder of metadata.folders) {
		await syncLocalFolder(path.join(localPath, folder.name), path.join(ipfsPath, folder.hash));
	}

	return metadata;
}

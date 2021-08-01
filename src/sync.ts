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
		const filenameHash = getHashOfString(localFile.name);
		const stats = await fs.promises.stat(fileLocalPath);
		const fileIpfsPath = path.join(ipfsPath, filenameHash);
		const oldFileBackup = metadata.files.find((f) => f.filenameHash === filenameHash);
		const ipfsFile = ipfsFiles.find((f) => f.name === filenameHash);

		const mimeType = mime.lookup(localFile.name) || null;
		const fileBackup: FileBackup = {
			filename: localFile.name,
			filenameHash,
			fileHash: 'unset',
			mimeType,
			ipfsHash: 'unset',
			mtime: stats.mtime.toISOString()
		};

		const mtimeChanged = stats.mtime.toISOString() !== oldFileBackup?.mtime;
		if(mtimeChanged || !ipfsFile){
			const hash = await getFileHash(fileLocalPath);
			const hashChanged = hash !== oldFileBackup?.fileHash;

			if(hashChanged){
				console.log(`${localFile.name} changed (${oldFileBackup?.fileHash} -> ${hash})`);
			}

			fileBackup.fileHash = hash;

			if (hashChanged || !ipfsFile) {
				const message = await createMessage({
					filename: localFile.name,
					binary: fs.createReadStream(fileLocalPath),
				});
				const encrypted = await encrypt({
					message,
					encryptionKeys: await getPublicKey(),
					signingKeys: await getPrivateKey(),
					format: 'binary',
				});

				await ipfs.files.write(fileIpfsPath, encrypted as BufferReadableStream, {
					create: true,
					truncate: true,
				});
			}
		}

		fileBackup.ipfsHash = (await ipfs.files.stat(fileIpfsPath)).cid.toString();

		newFiles.push(fileBackup);
	}
	// remove deleted files
	const oldFiles = Array.from(metadata.files);
	for (const file of oldFiles) {
		if (!newFiles.find((f) => f.filenameHash !== file.filenameHash) && ipfsFiles.find(f => f.name === file.filenameHash)) {
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

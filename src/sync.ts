import path from "path";
import fs from "fs";
import { getIpfs } from "./ipfs";
import { getFileHash } from "./files";
import { createMessage, encrypt } from "openpgp";
import { getPrivateKey, getPublicKey } from "./keys";
import { MFSEntry } from "ipfs-core-types/src/files";
import { readFolderMetadata, writeFolderMetadata } from "./device-state";

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
		const folderLocalPath = path.join(localPath, localFolder.name);
		const folderIpfsPath = path.join(ipfsPath, localFolder.name);
		const meta = metadata.folders.find((f) => f.name === localFolder.name);

		if (!meta) {
			await ipfs.files.mkdir(folderIpfsPath, { parents: true });

			metadata.folders.push({
				name: localFolder.name,
				hash: "not-implemented",
			});
		}
		foldersTouched.push(localFolder.name);
	}
	for (const ipfsFolder of ipfsFolders) {
		if (!foldersTouched.includes(ipfsFolder.name)) {
			await ipfs.files.rm(path.join(ipfsPath, ipfsFolder.name));
		}
	}

	// sync files
	while (localFiles.length > 0) {
		const localFile = localFiles.shift() as fs.Dirent;
		const fileLocalPath = path.join(localPath, localFile.name);
		const fileIpfsPath = path.join(ipfsPath, localFile.name);
		const meta = metadata.files.find((f) => f.filename === localFile.name);

		const hash = await getFileHash(fileLocalPath);
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

			if (meta) {
				meta.fileHash = localFile.name;
				meta.fileHash = hash;
			} else {
				metadata.files.push({
					filename: localFile.name,
					fileHash: hash,
				});
			}
		}

		filesTouched.push(localFile.name);
	}
	for (const ipfsFile of ipfsFiles) {
		if (!filesTouched.includes(ipfsFile.name)) {
			await ipfs.files.rm(path.join(ipfsPath, ipfsFile.name));
		}
	}

	await writeFolderMetadata(ipfsPath, metadata);

	for (const folder of metadata.folders) {
		await syncLocalFolder(path.join(localPath, folder.name), path.join(ipfsPath, folder.name));
	}

	return metadata;
}

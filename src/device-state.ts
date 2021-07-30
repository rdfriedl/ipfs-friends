import path from "path";
import { asyncIterableToString } from "./helpers/async";
import { exists, getIpfs } from "./ipfs";
import { decryptText, encryptText } from "./keys";

export async function readLocalEncryptedFile(ipfsPath: string) {
	const ipfs = await getIpfs();

	const content = await asyncIterableToString(ipfs.files.read(ipfsPath));
	const message = await decryptText(content);
	return message.data;
}
export async function readLocalEncryptedJsonFile<T>(ipfsPath: string, fallback: T) {
	try {
		const content = await readLocalEncryptedFile(ipfsPath);
		return JSON.parse(content) as T;
	} catch (e) {
		return fallback;
	}
}
export async function writeLocalEncryptedFile(ipfsPath: string, content: string) {
	const ipfs = await getIpfs();

	const message = await encryptText(content);
	await ipfs.files.write(ipfsPath, message, { create: true, truncate: true });
}
export async function writeLocalEncryptedJsonFile(ipfsPath: string, content: Record<any, any>) {
	await writeLocalEncryptedFile(ipfsPath, JSON.stringify(content));
}

export async function ensureSetup() {
	const ipfs = await getIpfs();

	if (!(await exists("/files"))) {
		await ipfs.files.mkdir("/files");
	}
}

type DeviceInfo = {
	name: string;
	ipns: string;
};
export function readDeviceInfo(): Promise<DeviceInfo> {
	return readLocalEncryptedJsonFile("/info", { name: "", ipns: "" });
}
export function writeDeviceInfo(info: DeviceInfo) {
	return writeLocalEncryptedJsonFile("/info", info);
}

export type FileBackup = {
	filename: string;
	fileHash: string;
	mimeType: string | null;
	ipfsHash: string;
};
export type FolderBackup = {
	name: string;
	hash: string;
};
export type BackupFolderMetadata = {
	files: FileBackup[];
	folders: FolderBackup[];
};

export async function readFolderMetadata(ipfsPath: string) {
	const metadataPath = path.join(ipfsPath, "metadata");
	const fallback: BackupFolderMetadata = {
		files: [],
		folders: [],
	};
	return await readLocalEncryptedJsonFile(metadataPath, fallback);
}
export async function writeFolderMetadata(ipfsPath: string, metadata: BackupFolderMetadata) {
	const metadataPath = path.join(ipfsPath, "metadata");
	return writeLocalEncryptedJsonFile(metadataPath, metadata);
}

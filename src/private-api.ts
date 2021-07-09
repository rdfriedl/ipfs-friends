import fetch from "node-fetch";
import { createMessage, decrypt, encrypt, sign } from "openpgp";
import { apiUrl } from "./const";
import { getPrivaryPublicUser, getPrivateKey, getPublicKey } from "./keys";

export type FileBackup = {
	path: string;
	ipfsHash: string;
	fileHash: string;
};

export async function fetchFile(path: string) {
	const url = new URL(path, apiUrl);
	return await fetch(url.toString()).then((res) => res.text());
}
export async function fetchJsonFile<T = string>(path: string) {
	const url = new URL(path, apiUrl);
	return (await fetch(url.toString()).then((res) => res.json())) as T;
}
export async function fetchEncryptedFile(path: string) {
	const url = new URL(path, apiUrl);
	const encryptedRes = await fetch(url.toString()).then((res) => res.text());

	const privateKey = await getPrivateKey();
	const decrypted = await decrypt({
		message: await createMessage({ text: encryptedRes }),
		decryptionKeys: privateKey,
	});

	return decrypted.data;
}

function convertBodyToString(body: string | Record<any, any>) {
	if (typeof body === "object") {
		return JSON.stringify(body);
	} else return body;
}
export async function updateFile(path: string, contents: string | Record<any, any>) {
	const url = new URL(path, apiUrl);
	const body = convertBodyToString(contents);

	const signed = await sign({
		message: await createMessage({ text: body }),
		signingKeys: await getPrivateKey(),
		armor: true,
	});

	return await fetch(url.toString(), { body: signed, method: "post" }).then((res) => res.text());
}
export async function updateEncryptedFile(path: string, contents: string | Record<any, any>) {
	const body = convertBodyToString(contents);
	const encrypted = encrypt({
		message: await createMessage({ text: body }),
		encryptionKeys: await getPublicKey(),
		signingKeys: await getPrivateKey(),
		armor: true,
	});

	return await updateFile(path, encrypted);
}

export async function fetchFileBackups() {
	const user = await getPrivaryPublicUser();

	try {
		return await fetchJsonFile<FileBackup[]>(`/private/${user.userID?.email}/files`);
	} catch (e) {
		console.log("failed to fetch file backups");

		return [];
	}
}
export async function updateFileBackups(files: FileBackup[]) {
	const user = await getPrivaryPublicUser();

	await updateFile(`/private/${user.userID?.email}/files`, files);
}

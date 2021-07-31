import pfs from "fs/promises";
import { createMessage, decrypt, encrypt, PrivateKey, PublicKey, readKey, readMessage, readPrivateKey } from "openpgp";
import { privateKeyPath, publicKeyPath } from "./const";

let privateKey: PrivateKey;
export async function getPrivateKey() {
	if (!privateKey) {
		privateKey = await readPrivateKey({
			armoredKey: await pfs.readFile(privateKeyPath, { encoding: "utf-8" }),
		});
	}

	return privateKey;
}

let publicKey: PublicKey;
export async function getPublicKey() {
	if (!publicKey) {
		publicKey = await readKey({
			armoredKey: await pfs.readFile(publicKeyPath, { encoding: "utf-8" }),
		});
	}

	return publicKey;
}

export async function encryptText(text: string) {
	const privateKey = await getPrivateKey();
	const publicKey = await getPublicKey();
	const message = await createMessage({ text });
	return await encrypt({ message, encryptionKeys: publicKey, signingKeys: privateKey, format: 'armored' });
}
export async function decryptText(text: string, expectSigned = true) {
	const privateKey = await getPrivateKey();
	const publicKey = await getPublicKey();
	const message = await readMessage({ armoredMessage: text });
	return await decrypt({ message, decryptionKeys: privateKey, verificationKeys: publicKey, expectSigned });
}

export async function getPrivaryPublicUser() {
	const key = await getPublicKey();
	const primary = await key.getPrimaryUser();
	return primary.user;
}

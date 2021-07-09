import pfs from "fs/promises";
import { PrivateKey, PublicKey, readKey, readPrivateKey } from "openpgp";
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

export async function getPrivaryPublicUser() {
	const key = await getPublicKey();
	const primary = await key.getPrimaryUser();
	return primary.user;
}

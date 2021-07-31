import crypto from "crypto";

export function getHashOfString(string: string, format: string = "sha1") {
	const shasum = crypto.createHash(format);
	shasum.update(string);
	return shasum.digest("hex");
}

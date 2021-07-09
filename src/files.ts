import fs from "fs";
import crypto from "crypto";

export function getFileHash(filePath: string, type = "sha1"): Promise<string> {
	return new Promise((res, rej) => {
		const hash = crypto.createHash(type);
		hash.setEncoding("hex");
		fs.createReadStream(filePath).pipe(hash);
		hash.on("finish", () => {
			res(hash.read());
		});
	});
}

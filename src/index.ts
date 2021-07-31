import { photoFolderPath } from "./const";
import { updateInfo, updateIpns } from "./device-info";
import { ensureSetup } from "./device-state";
import { syncLocalFolder } from "./sync";

async function main() {
	await ensureSetup();

	await sync();
}

async function sync() {
	await syncLocalFolder(photoFolderPath, "/files");
	await updateInfo();
	await updateIpns();

	console.log("waiting one minutes before next sync");
	setTimeout(sync, 60 * 1000);
}

main();

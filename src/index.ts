import { photoFolderPath } from "./const";
import { updateInfo } from "./device-info";
import { ensureSetup } from "./device-state";
import { syncLocalFolder } from "./sync";

async function main() {
	await ensureSetup();
	await syncLocalFolder(photoFolderPath, "/files");
	await updateInfo();
}
main();

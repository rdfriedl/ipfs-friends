import { photoFolderPath } from "./const";
import { stop } from "./ipfs";
import { syncLocalFolder } from "./sync";

async function main() {
	await syncLocalFolder(photoFolderPath, "/files");
}
main();

process.on("SIGINT", async () => {
	console.info("stopping ipfs");
	await stop();
	process.exit();
});

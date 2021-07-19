import { deviceName } from "./const";
import { readDeviceInfo, writeDeviceInfo } from "./device-state";
import { getIpfs } from "./ipfs";

export async function updateInfo() {
	const info = await readDeviceInfo();

	await writeDeviceInfo(
		Object.assign(info, {
			name: deviceName,
		})
	);

	await updateIpns();
}

export async function updateIpns() {
	const ipfs = await getIpfs();

	const root = await ipfs.files.stat("/");
	const { name } = await ipfs.name.publish(root.cid);
	console.log(`ipns updated to ${root.cid} ipns://${name}`);
}
// export async function getIpns() {
// 	const ipfs = await getIpfs();

// 	// update ipns record
// 	const root = await ipfs.files.stat("/");
// 	await ipfs.name.publish(root.cid);

// 	console.log(`ipns updated to ${root.cid}`);
// }

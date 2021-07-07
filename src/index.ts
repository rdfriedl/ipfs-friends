import {create as createIpfsNode, IPFS} from 'ipfs-core';
import path from 'path';
import { config } from 'dotenv';
import fs from 'fs';
import { PrivateKey, PublicKey, readKey, readPrivateKey, createMessage, encrypt } from 'openpgp';
import crypto from 'crypto';

config();

type FileBackup = {
	path: string,
	ipfsHash: string,
	fileHash: string,
}
type State = {
	fileBackups: FileBackup[]
}

type Context = {
	publicKey: PublicKey,
	privateKey: PrivateKey,
	ipfs: IPFS,
}

const statePath = path.resolve(process.cwd(), 'data/state.json');
const ipfsPath = path.resolve(process.cwd(), 'data/ipfs');

async function readState(){
	try {
		const raw = await fs.promises.readFile(statePath, {encoding: 'utf-8'});
		return JSON.parse(raw) as State;
	}
	catch(e){
		console.error('Failed to read state');
		return {
			fileBackups: []
		} as State;
	}
}

async function writeState(state: State){
	await fs.promises.writeFile(statePath, JSON.stringify(state, null, 2), {encoding: 'utf-8'})
}

async function main(){
	if(!process.env.PRIVATE_KEY_PATH){
		throw new Error('PRIVATE_KEY_PATH must be set');
	}
	if(!process.env.PUBLIC_KEY_PATH){
		throw new Error('PUBLIC_KEY_PATH must be set');
	}
	const armoredPrivateKey = await fs.promises.readFile(process.env.PRIVATE_KEY_PATH, {encoding: 'utf-8'});
	const armoredPublicKey = await fs.promises.readFile(process.env.PRIVATE_KEY_PATH, {encoding: 'utf-8'});
	const publicKey = await readKey({armoredKey: armoredPublicKey});
	const privateKey = await readPrivateKey({armoredKey: armoredPrivateKey});

	const ipfs = await createIpfsNode({
		repo: ipfsPath,
	});

	const context:Context = {ipfs, publicKey, privateKey};

	setInterval(() => backupFiles(context), 10 * 1000);
}

function getFileHash(filePath: string, type = 'sha1'): Promise<string>{
	return new Promise((res, rej) => {
		const hash = crypto.createHash(type);
		hash.setEncoding('hex');
		fs.createReadStream(filePath).pipe(hash);
		hash.on('finish', () => {
			res(hash.read());
		})
	})
}

async function backupFiles({ipfs, publicKey, privateKey}: Context){
	const state = await readState();
	if(!process.env.FOLDER_PATH){
		throw new Error('FOLDER_PATH must be set');
	}
	const folderPath = path.resolve(process.env.FOLDER_PATH);
	const files = await fs.promises.readdir(folderPath);

	for(const filename of files){
		const filePath = path.resolve(folderPath, filename);
		const stat = await fs.promises.stat(filePath);

		if(!stat.isDirectory()){
			const fileHash = await getFileHash(filePath);

			const backup = state.fileBackups.find(b => b.path === filename);

			if(backup && backup.fileHash !== fileHash){
				console.log(`Removing old file ${filePath}, old: ${backup.fileHash} new: ${fileHash}`);
				state.fileBackups = state.fileBackups.filter(b => b.path !== filePath);
				// await ipfs.pin.rm(backup.ipfsHash);
			}

			if(!backup || backup.fileHash !== fileHash){
				const message = await createMessage({filename: filename, binary: fs.createReadStream(filePath)});
				const encrypted: unknown = await encrypt({message, encryptionKeys: publicKey, signingKeys: privateKey, armor: false});

				const { cid } = await ipfs.add(encrypted as ReadableStream<Uint8Array>);
				await ipfs.pin.add(cid);

				console.log(`added ${filename} to ipfs ${cid.toString()}`)
				state.fileBackups.push({
					path: filename,
					ipfsHash: cid.toString(),
					fileHash: fileHash
				})
			}
		}
	}

	await writeState(state);
}

main();

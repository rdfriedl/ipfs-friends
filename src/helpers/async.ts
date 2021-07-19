export async function asyncIterableToString(iterable: AsyncIterable<Uint8Array>) {
	const decoder = new TextDecoder("utf-8");
	let content = "";
	for await (const chunk of iterable) {
		content += decoder.decode(chunk, { stream: true });
	}
	return content;
}

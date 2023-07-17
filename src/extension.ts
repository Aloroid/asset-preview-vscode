/* eslint-disable @typescript-eslint/naming-convention */
// can't do anything about how roblox formats json

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios from 'axios';
import { LRUCache } from 'lru-cache';

let size = "110x110";
const cacheImages: LRUCache<number, string> = new LRUCache({
	max: 10000,
	ttl: 1000 * 60 * 1, // 5 minutes

	fetchMethod: async (id, _, options) => {
		const request = await axios({
			method: 'get',
			url: 'https://thumbnails.roblox.com/v1/assets',
			params: {
				assetIds: [id],
				returnPolicy: "PlaceHolder",
				size: size,
				format: "Png",
				isCircular: false
			}
		});
		const entry = request.data?.data?.[0];

		if (options.signal.aborted) {
			return undefined;
		}

		if (entry === undefined) {
			return "";
		}

		return `![image](${entry.imageUrl})`;

	}
});
const cacheProductInfo: LRUCache<number, string> = new LRUCache({
	max: 1000,
	ttl: 1000 * 60 * 5, // 5 minutes

	fetchMethod: async (id, _, options) => {
		const request = await axios({
			method: 'get',
			url: `https://economy.roblox.com/v2/assets/${id}/details`,
		});

		if (options.signal.aborted) {
			return undefined;
		}

		if (request.data.errors) {
			console.error(`${request.data.errors[0].code}, ${request.data.errors[0].message}`);
		}

		const productData = request.data;
		const created = new Date(productData.Created);
		const updated = new Date(productData.Updated);

		return `
Name: ${productData.Name}  
Created By: ${productData.Creator.Name}  
---
${productData.Description}\n
---
Created At: ${created.toUTCString()}  
Last Updated: ${updated.toUTCString()}
`;

	}
});

function getId(text: string, position: vscode.Position, requirePrefix: boolean) {

	let regex = /(?:rbxassetid:\/\/)?([0-9]*)/g;

	if (requirePrefix) {
		regex = /rbxassetid:\/\/([0-9]*)/g;
	}

	let id;
	for (const match of text.matchAll(regex)) {
		if (match.index === undefined) { continue; }
		const begin = match.index;
		const finish = begin + match[0].length;

		const txt = text.slice(begin, finish);

		if (position.character >= begin && position.character <= finish) {
			id = +match[1];
			break;
		}
	}

	if (id === undefined) {
		return undefined;
	};

	return id;

}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	let disposable = vscode.languages.registerHoverProvider(['lua', 'luau', 'json'], {
		async provideHover(document, position, token) {

			const configuration = vscode.workspace.getConfiguration('roblox-asset-preview-vscode');
			const requirePrefix = configuration.get("requirePrefix") as boolean;
			const imageSize = configuration.get("imageSize") as string;

			// clear cache, image size changed
			if (size !== imageSize) {
				cacheImages.clear();
				size = imageSize; // iffy
			}

			// Try and get the id from the document that we're hovering over
			const line = document.lineAt(position.line);
			const text = line.text.trim();
			const id = getId(text, position, requirePrefix);

			// Return undefined if there isn't anything going on
			if (id === undefined) {
				return undefined;
			}

			// Search from the cache if there is anything in there
			const image = await cacheImages.fetch(id) || "";
			//const productData = await cacheProductInfo.fetch(id) || "";

			if (token.isCancellationRequested === true) {
				return undefined;
			} else {
				return new vscode.Hover(image);
			}

		}

	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }

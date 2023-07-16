// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import axios, { AxiosResponse } from 'axios';

const prefix = "rbxassetid://";
const cacheImages: Map<number, AxiosResponse> = new Map();

async function getImage(image: number) {

	let response = cacheImages.get(image);

	if (response) {
		return response;
	} else {
		return axios({
			method: 'get',
			url: 'https://thumbnails.roblox.com/v1/assets',
			params: {
				assetIds: [image],
				returnPolicy: "PlaceHolder",
				size: "110x110",
				format: "Png",
				"isCircular": false
			},
			validateStatus: () => {
				return true;
			}
		});
	}
}

function getId(text: string, position: vscode.Position) {

	const configuration = vscode.workspace.getConfiguration('roblox-asset-preview-vscode');
	const requirePrefix = configuration.get("requirePrefix");

	let regex = /([0-9]*)/g;
	let match

	if (requirePrefix) {
		regex = /rbxassetid:\/\/([0-9]*)/g;
	}

	let begin: number = -1;
	let id;
	for (const match of text.matchAll(regex)) {
		if (match.index === undefined) { continue; }
		begin = match.index;
		const finish = begin + match[0].length;

		if (position.character >= begin && position.character <= finish) {
			id = +match[1];
			break;
		}
	}

	if (id === undefined || begin === -1) {
		return undefined;
	};

	return id;

}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	let disposable = vscode.languages.registerHoverProvider(['lua', 'luau', 'json'], {
		async provideHover(document, position, token) {

			// Try and get the id from the document that we're hovering over
			const line = document.lineAt(position.line);
			const text = line.text.trim();
			const id = getId(text, position);

			// Return undefined if there isn't anything going on
			if (id === undefined) {
				return undefined;
			}

			// Search from the cache if there is anything in there
			let response = await getImage(id);

			if (token.isCancellationRequested === true) {
				return undefined;
			} else if (response.status === 200) {
				cacheImages.set(id, response);
				const imageData = response.data.data[0];
				// no image data
				if (imageData === undefined) { return undefined; }
				return new vscode.Hover(`![image](${imageData.imageUrl})`);
			} else {

				// remove it after 5 seconds so that we hopefully don't get ratelimited idk
				if (cacheImages.get(id) === undefined) {
					setTimeout(() => {
						cacheImages.delete(id);
					}, 5000);
				}
				cacheImages.set(id, response);

				vscode.window.showInformationMessage(`Failed to run: ${response.status}, ${response.statusText}`);
				return undefined;
			}

		}

	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }

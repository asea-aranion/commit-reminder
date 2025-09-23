// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GitExtension } from './git';
import parse from "diffparser";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	const gitExtension = await vscode.extensions.getExtension<GitExtension>('vscode.git')?.activate();
	
	if (!gitExtension) {
		vscode.window.showErrorMessage('Git extension not found. Commit Reminder requires the VSCode Git extension.');
		
		const showError = () => {
			vscode.window.showErrorMessage('Commit Reminder requires the VSCode Git extension.');
		};

		vscode.commands.registerCommand("commit-reminder.countChanges", showError);

		return;
	}

	const git = gitExtension.getAPI(1);
	const repo = git.repositories[0];

	const countChanges = vscode.commands.registerCommand('commit-reminder.countChanges', async () => {
		const diff = await repo.diff(false);
		const parsedDiff = parse(diff);

		let totalAdds = 0, totalDels = 0;

		for (const fileDiff of parsedDiff) {
			totalAdds += fileDiff.additions;
			totalDels += fileDiff.deletions;
		}

		vscode.window.showInformationMessage("Total changes: +" + totalAdds + " | -" + totalDels);
	});

	context.subscriptions.push(countChanges);

}

// This method is called when your extension is deactivated
export function deactivate() {}

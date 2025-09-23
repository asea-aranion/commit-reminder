// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GitExtension } from './git';
import parse from "diffparser";

const getAddsAndDels = async (diff: string): Promise<[number, number]> => {
	const parsedDiff = parse(diff);

	let totalAdds = 0, totalDels = 0;

	for (const fileDiff of parsedDiff) {
		totalAdds += fileDiff.additions;
		totalDels += fileDiff.deletions;
	}

	return [totalAdds, totalDels];
};

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

	const autoCheckChanges = vscode.commands.registerCommand('commit-reminder.autoCheckChanges', () => {
			vscode.workspace.onDidSaveTextDocument(async () => {
			const threshold = context.globalState.get<number>("threshold") ?? 1;

			const diff = await repo.diff(false);
			const [totalAdds, totalDels] = await getAddsAndDels(diff);

			if (totalAdds + totalDels > threshold) {
				vscode.window.showInformationMessage(`You have more than ${threshold} uncommitted changes. You may want to stage and commit changes now.`);
			}
		});
	});

	context.subscriptions.push(autoCheckChanges);

	const countChanges = vscode.commands.registerCommand('commit-reminder.countChanges', async () => {
		const diff = await repo.diff(false);
		const [totalAdds, totalDels] = await getAddsAndDels(diff);

		vscode.window.showInformationMessage(`Total changes: +${totalAdds} | -${totalDels}`);
	});

	context.subscriptions.push(countChanges);

}

export function deactivate() {}

import * as vscode from 'vscode';
import { GitExtension } from './git';
import parse from "diffparser";

// counts number of +/- changes in all changed files
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

	// set up git extension api and show error notification if not found
	const gitExtension = await vscode.extensions.getExtension<GitExtension>('vscode.git')?.activate();
	
	if (!gitExtension) {
		vscode.window.showErrorMessage('Git extension not found. Commitiquette requires the VSCode Git extension.');
		
		return;
	}

	const git = gitExtension.getAPI(1);
	const repo = git.repositories[0];

	// mutes autocheck notifications for 5 minutes
	const setRemindersMuted = () => {
		context.workspaceState.update("lastMuted", Date.now());

		vscode.window.showInformationMessage("You will not receive commit reminders in this workspace for 5 minutes.");
	};

	const muteReminders = vscode.commands.registerCommand('commitiquette.muteReminders', setRemindersMuted);

	// checks on file save if number of +/- changes is above threshold for prompting 
	const autoCheckChanges = vscode.commands.registerCommand('commitiquette.autoCheckChanges', () => {

			vscode.workspace.onDidSaveTextDocument(async () => {

				const lastMuted = context.workspaceState.get<number>("lastMuted");
				if (!lastMuted || lastMuted < Date.now() - 5 * 60 * 1000) {

					const threshold = context.workspaceState.get<number>("threshold") ?? (context.globalState.get<number>("threshold") ?? 100);
					
					const diff = await repo.diff(false);
					const [totalAdds, totalDels] = await getAddsAndDels(diff);

					if (totalAdds + totalDels > threshold) {
						const selection = await vscode.window.showWarningMessage(
							`You have more than ${threshold} uncommitted changes: +${totalAdds} | -${totalDels}. You may want to stage and commit changes now.`,
							"Mute for 5 minutes"
						);

						if (selection) {
							setRemindersMuted();
						}
					}
				}
		});
	});

	// updates global threshold with user input
	const changeGlobalDefaultThreshold = vscode.commands.registerCommand('commitiquette.changeGlobalDefaultThreshold', async () => {
		const input = await vscode.window.showInputBox(
			{ 
				prompt: "Number of uncommitted changes after which you would like to be prompted (by default in all workspaces)",
				placeHolder: "100"
			});

		if (!input) {
			vscode.window.showErrorMessage("A value must be entered for the new threshold.");
			return;
		}

		const newThreshold = Number.parseInt(input);

		if (Number.isNaN(newThreshold) || newThreshold < 0) {
			vscode.window.showErrorMessage("The new threshold must be a valid positive integer.");
			return;
		}

		context.globalState.update("threshold", newThreshold);
	});

	// updates workspace-specific threshold with user input
	const changeWorkspaceThreshold = vscode.commands.registerCommand('commitiquette.changeWorkspaceThreshold', async () => {
		const input = await vscode.window.showInputBox(
			{ 
				prompt: "Number of uncommitted changes after which you would like to be prompted (in this workspace only)",
				placeHolder: "100"
			});

		if (!input) {
			vscode.window.showErrorMessage("A value must be entered for the new threshold.");
			return;
		}

		const newThreshold = Number.parseInt(input);

		if (Number.isNaN(newThreshold) || newThreshold < 0) {
			vscode.window.showErrorMessage("The new threshold must be a valid positive integer.");
			return;
		}

		context.workspaceState.update("threshold", newThreshold);
	});

	// shows number of +/- changes
	const countChanges = vscode.commands.registerCommand('commitiquette.countChanges', async () => {
		const diff = await repo.diff(false);
		const [totalAdds, totalDels] = await getAddsAndDels(diff);

		vscode.window.showInformationMessage(`Total changes: +${totalAdds} | -${totalDels}`);
	});

	// push all disposables
	context.subscriptions.push(muteReminders, autoCheckChanges, changeGlobalDefaultThreshold, changeWorkspaceThreshold, countChanges);

}

export function deactivate() {}

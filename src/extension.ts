import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  // Register the original command (run all tests in file)
  context.subscriptions.push(
    vscode.commands.registerCommand('spock-test-runner.runTest', async (uri: vscode.Uri) => {
      const filePath = uri.fsPath;
      if (!filePath.endsWith('.groovy')) {
        vscode.window.showErrorMessage('Please select a .groovy file.');
        return;
      }
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found.');
        return;
      }
      const buildTool = detectBuildTool(workspaceFolder.uri.fsPath);
      if (!buildTool) {
        vscode.window.showErrorMessage('No supported build tool detected.');
        return;
      }
      const testClassName = extractTestName(filePath);
      if (!testClassName) {
        vscode.window.showErrorMessage('Could not determine test class name.');
        return;
      }
      await runSpockTest(testClassName, null, workspaceFolder.uri.fsPath, buildTool);
    })
  );

  // Register the specific test command (for CodeLens)
  context.subscriptions.push(
    vscode.commands.registerCommand('spock-test-runner.runSpecificTest', async (testClassName: string, testMethod: string, workspacePath: string, buildTool: string) => {
      await runSpockTest(testClassName, testMethod, workspacePath, buildTool as 'gradle' | 'maven');
    })
  );

  // Register CodeLens provider for Groovy files
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: 'groovy', scheme: 'file' },
      new SpockTestCodeLensProvider()
    )
  );
}

// Detect build tool
function detectBuildTool(workspacePath: string): 'gradle' | 'maven' | null {
  if (fs.existsSync(path.join(workspacePath, 'build.gradle'))) {
    return 'gradle';
  } else if (fs.existsSync(path.join(workspacePath, 'pom.xml'))) {
    return 'maven';
  }
  return null;
}

// Extract test class name
function extractTestName(filePath: string): string | null {
  const fileName = path.basename(filePath, '.groovy');
  return fileName.endsWith('Spec') || fileName.endsWith('Test') ? fileName : null;
}

// Run the Spock test
async function runSpockTest(testClassName: string, testMethod: string | null, workspacePath: string, buildTool: 'gradle' | 'maven') {
  const terminal = vscode.window.createTerminal('Spock Test Runner');
  terminal.show();

  const testName = testMethod ? `${testClassName}.${testMethod.replace(/\s+/g, '.')}` : testClassName;

  if (buildTool === 'gradle') {
    terminal.sendText(`cd ${workspacePath}`);
    terminal.sendText(`./gradlew test --tests ${testName}`);
  } else if (buildTool === 'maven') {
    terminal.sendText(`cd ${workspacePath}`);
    terminal.sendText(`mvn test -Dtest=${testName}`);
  }
}

// CodeLens provider for Spock tests
class SpockTestCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const testMethodRegex = /def\s+['"]([^'"]+)['"]\s*\(\s*\)/g;
    const testClassName = extractTestName(document.fileName);

    if (!testClassName) return codeLenses;

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (!workspaceFolder) return codeLenses;

    const buildTool = detectBuildTool(workspaceFolder.uri.fsPath);
    if (!buildTool) return codeLenses;

    let match;
    while ((match = testMethodRegex.exec(text)) !== null) {
      const testMethod = match[1];
      const line = document.lineAt(document.positionAt(match.index).line);

      codeLenses.push(
        new vscode.CodeLens(line.range, {
          title: '▶ Run Test', // Green play button (▶) as text
          command: 'spock-test-runner.runSpecificTest',
          arguments: [testClassName, testMethod, workspaceFolder.uri.fsPath, buildTool],
          tooltip: `Run "${testMethod}"`
        })
      );
    }

    return codeLenses;
  }
}

export function deactivate() {}
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

export function activate(context: vscode.ExtensionContext) {
  const logger = vscode.window.createOutputChannel('Spock Test Runner');
  const diagnostic = vscode.languages.createDiagnosticCollection('spock-test-runner');

  // Command to run all tests in a file
  context.subscriptions.push(
    vscode.commands.registerCommand('spock-test-runner.runTest', async (uri: vscode.Uri) => {
      const filePath = uri.fsPath;
      if (!filePath.endsWith('.groovy')) {
        vscode.window.showErrorMessage('Please select a .groovy file.');
        return;
      }
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      const buildTool = workspaceFolder ? detectBuildTool(workspaceFolder.uri.fsPath) : null;
      const testClassName = extractTestName(filePath);

      if (!workspaceFolder || !buildTool || !testClassName) {
        vscode.window.showErrorMessage('Invalid setup: Check workspace, build tool, or file name.');
        logger.appendLine(`[ERROR] ${filePath}: Invalid setup - Workspace: ${!!workspaceFolder}, Build Tool: ${buildTool}, Class: ${testClassName}`);
        return;
      }

      await runSpockTest(testClassName, null, workspaceFolder.uri.fsPath, buildTool, logger);
    })
  );

  // Command to run a specific test
  context.subscriptions.push(
    vscode.commands.registerCommand('spock-test-runner.runSpecificTest', async (testClassName: string, testMethod: string, workspacePath: string, buildTool: 'gradle' | 'maven') => {
      logger.appendLine(`[INFO] Running test ${testClassName}.${testMethod}`);
      await runSpockTest(testClassName, testMethod, workspacePath, buildTool, logger);
    })
  );

  // Command to debug a specific test
  context.subscriptions.push(
    vscode.commands.registerCommand('spock-test-runner.debugSpecificTest', async (testClassName: string, testMethod: string, workspacePath: string, buildTool: 'gradle' | 'maven') => {
      logger.appendLine(`[INFO] Debugging test ${testClassName}.${testMethod}`);
      await runSpockTest(testClassName, testMethod, workspacePath, buildTool, logger, true);
    })
  );

  // CodeLens provider with regex
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: 'groovy', scheme: 'file' },
      {
        provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
          const codeLenses: vscode.CodeLens[] = [];
          const text = document.getText();
          const testClassName = extractTestName(document.fileName);
          const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
          const buildTool = workspaceFolder ? detectBuildTool(workspaceFolder.uri.fsPath) : null;

          if (!testClassName || !workspaceFolder || !buildTool) {
            logger.appendLine(`[ERROR] ${document.fileName}: Invalid setup - Class: ${testClassName}, Workspace: ${!!workspaceFolder}, Build Tool: ${buildTool}`);
            return codeLenses;
          }

          // Regex to find Spock test methods
          const testMethodRegex = /def\s+['"]([^'"]+)['"]\s*\(\s*\)/g;
          let match;
          while ((match = testMethodRegex.exec(text)) !== null) {
            const testMethod = match[1];
            const line = document.lineAt(document.positionAt(match.index).line);
            logger.appendLine(`[DEBUG] ${document.fileName}: Found test method '${testMethod}' at line ${line.lineNumber + 1}`);

            codeLenses.push(
              new vscode.CodeLens(line.range, {
                title: '▶ Run Test',
                command: 'spock-test-runner.runSpecificTest',
                arguments: [testClassName, testMethod, workspaceFolder.uri.fsPath, buildTool],
                tooltip: `Run "${testMethod}"`
              }),
              new vscode.CodeLens(line.range, {
                title: '🐛 Debug Test',
                command: 'spock-test-runner.debugSpecificTest',
                arguments: [testClassName, testMethod, workspaceFolder.uri.fsPath, buildTool],
                tooltip: `Debug "${testMethod}"`
              })
            );
          }

          if (codeLenses.length === 0) {
            logger.appendLine(`[INFO] ${document.fileName}: No test methods found.`);
          }

          return codeLenses;
        }
      }
    )
  );

  context.subscriptions.push(logger, diagnostic);
}

// Utility functions
function detectBuildTool(workspacePath: string): 'gradle' | 'maven' | null {
  if (fs.existsSync(path.join(workspacePath, 'build.gradle'))) return 'gradle';
  if (fs.existsSync(path.join(workspacePath, 'pom.xml'))) return 'maven';
  return null;
}

function extractTestName(filePath: string): string | null {
  const fileName = path.basename(filePath, '.groovy');
  return fileName.endsWith('Spec') || fileName.endsWith('Test') ? fileName : null;
}

async function runSpockTest(testClassName: string, testMethod: string | null, workspacePath: string, buildTool: 'gradle' | 'maven', logger: vscode.OutputChannel, debug: boolean = false) {
  const terminal = vscode.window.createTerminal('Spock Test Runner');
  terminal.show();

  // Escape spaces in test method name and wrap in quotes
  const escapedTestName = testMethod 
    ? `"${testClassName}.${testMethod}"` 
    : `"${testClassName}"`;
  
  const commandArgs = buildTool === 'gradle'
    ? ['./gradlew', 'test', `--tests ${escapedTestName}`].concat(debug ? ['--debug-jvm'] : [])
    : ['mvn', 'test', `-Dtest=${escapedTestName}`].concat(debug ? ['-Dmaven.surefire.debug'] : []);

  try {
    logger.appendLine(`[INFO] Starting ${debug ? 'debug' : 'test'}: ${testClassName}.${testMethod || ''} in ${workspacePath}`);
    terminal.sendText(`cd ${workspacePath}`);
    
    // Join the command arguments properly for the terminal
    const fullCommand = commandArgs.join(' ');
    terminal.sendText(fullCommand);

    if (debug) {
      vscode.window.showInformationMessage('Debugger is ready to attach. The test will wait for debugger connection on port 5005.');
    }

  } catch (error: unknown) {
    const errorMessage = `Failed to run ${testClassName}.${testMethod || ''}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    terminal.sendText(errorMessage);
    logger.appendLine(`[ERROR] ${errorMessage}`);
    vscode.window.showErrorMessage(errorMessage);
  }
}

export function deactivate() {}
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function activate(context) {
    const logger = vscode.window.createOutputChannel('Spock Test Runner');
    const diagnostic = vscode.languages.createDiagnosticCollection('spock-test-runner');
    // Command to run all tests in a file
    context.subscriptions.push(vscode.commands.registerCommand('spock-test-runner.runTest', async (uri) => {
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
    }));
    // Command to run a specific test
    context.subscriptions.push(vscode.commands.registerCommand('spock-test-runner.runSpecificTest', async (testClassName, testMethod, workspacePath, buildTool) => {
        logger.appendLine(`[INFO] Running test ${testClassName}.${testMethod}`);
        await runSpockTest(testClassName, testMethod, workspacePath, buildTool, logger);
    }));
    // Command to debug a specific test
    context.subscriptions.push(vscode.commands.registerCommand('spock-test-runner.debugSpecificTest', async (testClassName, testMethod, workspacePath, buildTool) => {
        logger.appendLine(`[INFO] Debugging test ${testClassName}.${testMethod}`);
        await runSpockTest(testClassName, testMethod, workspacePath, buildTool, logger, true);
    }));
    // CodeLens provider with regex
    context.subscriptions.push(vscode.languages.registerCodeLensProvider({ language: 'groovy', scheme: 'file' }, {
        provideCodeLenses(document) {
            const codeLenses = [];
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
                codeLenses.push(new vscode.CodeLens(line.range, {
                    title: '▶ Run Test',
                    command: 'spock-test-runner.runSpecificTest',
                    arguments: [testClassName, testMethod, workspaceFolder.uri.fsPath, buildTool],
                    tooltip: `Run "${testMethod}"`
                }), new vscode.CodeLens(line.range, {
                    title: '🐛 Debug Test',
                    command: 'spock-test-runner.debugSpecificTest',
                    arguments: [testClassName, testMethod, workspaceFolder.uri.fsPath, buildTool],
                    tooltip: `Debug "${testMethod}"`
                }));
            }
            if (codeLenses.length === 0) {
                logger.appendLine(`[INFO] ${document.fileName}: No test methods found.`);
            }
            return codeLenses;
        }
    }));
    context.subscriptions.push(logger, diagnostic);
}
// Utility functions
function detectBuildTool(workspacePath) {
    if (fs.existsSync(path.join(workspacePath, 'build.gradle')))
        return 'gradle';
    if (fs.existsSync(path.join(workspacePath, 'pom.xml')))
        return 'maven';
    return null;
}
function extractTestName(filePath) {
    const fileName = path.basename(filePath, '.groovy');
    return fileName.endsWith('Spec') || fileName.endsWith('Test') ? fileName : null;
}
async function runSpockTest(testClassName, testMethod, workspacePath, buildTool, logger, debug = false) {
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
    }
    catch (error) {
        const errorMessage = `Failed to run ${testClassName}.${testMethod || ''}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        terminal.sendText(errorMessage);
        logger.appendLine(`[ERROR] ${errorMessage}`);
        vscode.window.showErrorMessage(errorMessage);
    }
}
function deactivate() { }
//# sourceMappingURL=extension.js.map
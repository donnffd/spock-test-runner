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
    // Register the original command (run all tests in file)
    context.subscriptions.push(vscode.commands.registerCommand('spock-test-runner.runTest', async (uri) => {
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
    }));
    // Register the specific test command (for CodeLens)
    context.subscriptions.push(vscode.commands.registerCommand('spock-test-runner.runSpecificTest', async (testClassName, testMethod, workspacePath, buildTool) => {
        await runSpockTest(testClassName, testMethod, workspacePath, buildTool);
    }));
    // Register CodeLens provider for Groovy files
    context.subscriptions.push(vscode.languages.registerCodeLensProvider({ language: 'groovy', scheme: 'file' }, new SpockTestCodeLensProvider()));
}
// Detect build tool
function detectBuildTool(workspacePath) {
    if (fs.existsSync(path.join(workspacePath, 'build.gradle'))) {
        return 'gradle';
    }
    else if (fs.existsSync(path.join(workspacePath, 'pom.xml'))) {
        return 'maven';
    }
    return null;
}
// Extract test class name
function extractTestName(filePath) {
    const fileName = path.basename(filePath, '.groovy');
    return fileName.endsWith('Spec') || fileName.endsWith('Test') ? fileName : null;
}
// Run the Spock test
async function runSpockTest(testClassName, testMethod, workspacePath, buildTool) {
    const terminal = vscode.window.createTerminal('Spock Test Runner');
    terminal.show();
    const testName = testMethod ? `${testClassName}.${testMethod}` : testClassName;
    if (buildTool === 'gradle') {
        terminal.sendText(`cd ${workspacePath}`);
        terminal.sendText(`./gradlew test --tests ${testName}`);
    }
    else if (buildTool === 'maven') {
        terminal.sendText(`cd ${workspacePath}`);
        terminal.sendText(`mvn test -Dtest=${testName}`);
    }
}
// CodeLens provider for Spock tests
class SpockTestCodeLensProvider {
    provideCodeLenses(document, token) {
        const codeLenses = [];
        const text = document.getText();
        const testMethodRegex = /def\s+['"]([^'"]+)['"]\s*\(\s*\)/g;
        const testClassName = extractTestName(document.fileName);
        if (!testClassName)
            return codeLenses;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder)
            return codeLenses;
        const buildTool = detectBuildTool(workspaceFolder.uri.fsPath);
        if (!buildTool)
            return codeLenses;
        let match;
        while ((match = testMethodRegex.exec(text)) !== null) {
            const testMethod = match[1];
            const line = document.lineAt(document.positionAt(match.index).line);
            codeLenses.push(new vscode.CodeLens(line.range, {
                title: '▶ Run Test', // Green play button (▶) as text
                command: 'spock-test-runner.runSpecificTest',
                arguments: [testClassName, testMethod, workspaceFolder.uri.fsPath, buildTool],
                tooltip: `Run "${testMethod}"`
            }));
        }
        return codeLenses;
    }
}
function deactivate() { }
//# sourceMappingURL=extension.js.map
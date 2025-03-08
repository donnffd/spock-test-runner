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
    let disposable = vscode.commands.registerCommand('spock-test-runner.runTest', async (uri) => {
        const filePath = uri.fsPath;
        // Check if the file is a Groovy file
        if (!filePath.endsWith('.groovy')) {
            vscode.window.showErrorMessage('Please select a .groovy file to run Spock tests.');
            return;
        }
        // Get the workspace folder
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('No workspace folder found.');
            return;
        }
        // Detect build tool
        const buildTool = detectBuildTool(workspaceFolder.uri.fsPath);
        if (!buildTool) {
            vscode.window.showErrorMessage('No supported build tool (Gradle/Maven) detected.');
            return;
        }
        // Extract test class name
        const testClassName = extractTestName(filePath);
        if (!testClassName) {
            vscode.window.showErrorMessage('Could not determine test class name from file.');
            return;
        }
        // Get the specific test method
        const testMethod = await getTestMethod(filePath);
        if (!testMethod) {
            return; // User canceled or no method selected
        }
        // Run the specific Spock test
        await runSpockTest(testClassName, testMethod, workspaceFolder.uri.fsPath, buildTool);
    });
    context.subscriptions.push(disposable);
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
// Extract test class name from file path
function extractTestName(filePath) {
    const fileName = path.basename(filePath, '.groovy');
    return fileName;
}
// Get the specific test method from the file
async function getTestMethod(filePath) {
    const document = await vscode.workspace.openTextDocument(filePath);
    const text = document.getText();
    // Simple regex to find Spock test methods (e.g., "def 'my test'()")
    const testMethodRegex = /def\s+['"]([^'"]+)['"]\s*\(\s*\)/g;
    const testMethods = [];
    let match;
    while ((match = testMethodRegex.exec(text)) !== null) {
        testMethods.push(match[1]); // Capture the test method name
    }
    if (testMethods.length === 0) {
        vscode.window.showErrorMessage('No test methods found in the file.');
        return undefined;
    }
    // Let the user pick a test method
    const selectedMethod = await vscode.window.showQuickPick(testMethods, {
        placeHolder: 'Select a test method to run',
    });
    return selectedMethod;
}
// Run the specific Spock test
async function runSpockTest(testClassName, testMethod, workspacePath, buildTool) {
    const terminal = vscode.window.createTerminal('Spock Test Runner');
    terminal.show();
    // Spock test names need to replace spaces with dots and escape special characters if needed
    const normalizedTestMethod = testMethod.replace(/\s+/g, '.');
    const fullTestName = `${testClassName}.${normalizedTestMethod}`;
    if (buildTool === 'gradle') {
        terminal.sendText(`cd ${workspacePath}`);
        terminal.sendText(`./gradlew test --tests ${fullTestName}`);
    }
    else if (buildTool === 'maven') {
        terminal.sendText(`cd ${workspacePath}`);
        terminal.sendText(`mvn test -Dtest=${fullTestName}`);
    }
}
function deactivate() { }
//# sourceMappingURL=extension.js.map
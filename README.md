
# Spock Test Runner

A Visual Studio Code extension to run Spock tests in Groovy-based Java projects directly from the editor. This extension adds CodeLens "▶ Run Test" buttons above each Spock test method and supports running all tests in a file via a context menu command.

## Features

- **CodeLens Support**: Displays a "▶ Run Test" button above each Spock test method (e.g., `def "my test"()`) in `.groovy` files, allowing you to run individual tests with a single click.
- **Run All Tests**: Right-click a `.groovy` file and select "Run Spock Test" to execute all tests in the file.
- **Build Tool Integration**: Supports Gradle (`./gradlew test`) and Maven (`mvn test`) projects.

\!\[feature\]\(images/features.png\)

## Requirements

- **VS Code**: Version 1.85.0 or higher.
- **Node.js**: Version 18.x or 20.x (LTS recommended).
- **Java Runtime (JDK)**: Version 17 or 21, required for Groovy parsing (e.g., OpenJDK or Oracle JDK).


## For more information

* [For Contributions](https://github.com/donnffd/spock-test-runner)

**Enjoy!**

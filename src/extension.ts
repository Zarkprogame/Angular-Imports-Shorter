import * as vscode from 'vscode';

function extractImports(document: vscode.TextDocument, fullText: string) {
	
    const importRegEx = /^import\s+.*from\s+['"].*['"]\s*;?\s*$|^import\s+['"].*['"]\s*;?\s*$/gm;
    
    // 1. Usar matchAll para obtener todas las coincidencias como un array iterable.
    const matches = Array.from(fullText.matchAll(importRegEx));
    
    // Si no hay coincidencias, devolvemos el caso base.
    if (matches.length === 0) {
        return { importLines: [], importRange: new vscode.Range(0, 0, 0, 0) };
    }

    const importLines = matches.map(
        match => match[0].trim()
    );

    // 2. Calcular el rango de inicio y fin (usando la primera y la última coincidencia)
    
    // Primera coincidencia (para el punto de inicio)
    const firstMatch = matches[0];
    const startIndex = firstMatch.index!;

    // Última coincidencia (para el punto de fin)
    const lastMatch = matches[matches.length - 1];
    const endIndex = lastMatch.index! + lastMatch[0].length;

    // 3. Mapear los índices de carácter a las posiciones de VS Code
    const startPosition = document.positionAt(startIndex);
    const endPosition = document.positionAt(endIndex);

    // 4. Crear el objeto de rango
    const importRange = new vscode.Range(startPosition, endPosition);

    // Devolvemos las líneas limpias y el rango de reemplazo
    return { importLines, importRange };
}

function classifyAndSort(lines: string[]): string[] {

    const groups: { [key: string]: string[] } = {
        angular: [], // 1. @angular y librerías de terceros (rxjs, lodash, etc.)
        app: [],     // 2. Alias de la aplicación (@app/, @core/, etc.)
        relative: [] // 3. Rutas relativas (./, ../)
    };

    // 1. CLASIFICACIÓN
    const appAliasRegEx = /^import\s+.*from\s+['"]@\w+.*['"]/;
    
    lines.forEach(line => {
        if (line.includes('from \'./') || line.includes('from "../') || line.startsWith('import \'./') || line.startsWith('import \'../')) {
            groups.relative.push(line);
        } else if (line.includes('from \'@angular/')) {
            groups.angular.push(line);
        } else if (appAliasRegEx.test(line)) {
            groups.app.push(line);
        } else {
            groups.angular.push(line);
        }
    });

    // 2. ORDENAMIENTO (Alfabético dentro de cada grupo)
    groups.angular.sort();
    groups.app.sort();
    groups.relative.sort();

    // 3. CONSTRUCCIÓN DEL BLOQUE FINAL
    const sortedBlock: string[] = [];

    // Grupo 1: Angular y Terceros
    if (groups.angular.length > 0) {
        sortedBlock.push(...groups.angular);
    }

    // Grupo 2: Alias de la Aplicación (separado por una línea vacía)
    if (groups.app.length > 0) {
        if (sortedBlock.length > 0) {
            sortedBlock.push('');
        }
        sortedBlock.push(...groups.app);
    }

    // Grupo 3: Relativas (separado por una línea vacía)
    if (groups.relative.length > 0) {
        if (sortedBlock.length > 0) {
            sortedBlock.push('');
        }
        sortedBlock.push(...groups.relative);
    }

    // Salto de linea final
    if (sortedBlock.length > 0 && sortedBlock[sortedBlock.length - 1] !== '') {
        sortedBlock.push('');
    }

    return sortedBlock;
}

function sortAngularImports() {

    // 1. Verificar si hay un editor de texto activo
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        return; // No hay archivo abierto
    }

    const document = editor.document;
    
    // 2. Solo procesar archivos TypeScript (.ts)
    if (document.languageId !== 'typescript') {
        vscode.window.showWarningMessage('Angular Import Sorter solo funciona en archivos TypeScript (.ts).');
        return;
    }

    const fullText = document.getText();

    // 3. Implementación del Algoritmo de Clasificación
    const { importLines, importRange } = extractImports(document, fullText);

    if (importLines.length === 0) {
        vscode.window.showInformationMessage('No se encontraron importaciones para ordenar.');
        return;
    }

    const sortedImports = classifyAndSort(importLines);
    
    // 4. Crear el nuevo bloque de código con las importaciones ordenadas
    const newImportBlock = sortedImports.join('\n');
    
    // 5. Aplicar los cambios al documento
    editor.edit(editBuilder => {
        // Reemplazar el rango original de importaciones con el nuevo bloque
        editBuilder.replace(importRange, newImportBlock);
    }).then(success => {
        if (success) {
            vscode.window.showInformationMessage('¡Importaciones ordenadas con éxito!');
        } else {
            vscode.window.showErrorMessage('Error al aplicar la ordenación de importaciones.');
        }
    });
}

export function activate(context: vscode.ExtensionContext) {

	console.log('Tu extensión "Angular Import Sorter" está activa!');

    let disposable = vscode.commands.registerCommand('angular-sorter.sortImports', () => {
        sortAngularImports();
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}

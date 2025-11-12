import * as vscode from 'vscode';

function extractImports(document: vscode.TextDocument, fullText: string) {
	
    const importRegex = /^import\s+.*from\s+['"].*['"]\s*;?\s*$|^import\s+['"].*['"]\s*;?\s*$/gm;
    
    const importLines = [];
    const importBlocks = [];
    let match;

    while ((match = importRegex.exec(fullText)) !== null) {
        // Almacenamos solo la línea de importación (sin los posibles saltos de línea circundantes)
        importLines.push(match[0].trim());
        // Almacenamos la información del match para determinar el rango general
        importBlocks.push({ index: match.index, length: match[0].length });
    }
    
    if (importBlocks.length === 0) {
        return { importLines: [], nonImportContent: fullText, importRange: new vscode.Range(0, 0, 0, 0) };
    }

    // Calcular el rango total que ocupan todas las importaciones
    const firstImport = importBlocks[0];
    const lastImport = importBlocks[importBlocks.length - 1];

    const startPosition = document.positionAt(firstImport.index);
    const endPosition = document.positionAt(lastImport.index + lastImport.length);

    const importRange = new vscode.Range(startPosition, endPosition);

    return { importLines, nonImportContent: '', importRange };
}

function classifyAndSort(lines: string[]): string[] {
    const groups: { [key: string]: string[] } = {
        angular: [], // 1. @angular y librerías de terceros (rxjs, lodash, etc.)
        app: [],     // 2. Alias de la aplicación (@app/, @core/, etc.)
        relative: [] // 3. Rutas relativas (./, ../)
    };

    // 1. CLASIFICACIÓN
    const appAliasRegex = /^import\s+.*from\s+['"]@\w+.*['"]/; // Asumimos que @alias/ es tu convención
    
    lines.forEach(line => {
        if (line.includes('from \'./') || line.includes('from "../') || line.startsWith('import \'./') || line.startsWith('import \'../')) {
            groups.relative.push(line);
        } else if (line.includes('from \'@angular/')) {
            groups.angular.push(line);
        } else if (appAliasRegex.test(line)) {
            // Captura otros alias de la app como @core, @shared, etc.
            groups.app.push(line);
        } else {
            // Cualquier otra librería de terceros (rxjs, ngrx, etc.) cae aquí
            groups.angular.push(line);
        }
    });

    // 2. ORDENAMIENTO (Alfabético dentro de cada grupo)
    groups.angular.sort();
    groups.app.sort();
    groups.relative.sort();

    // 3. CONSTRUCCIÓN DEL BLOQUE FINAL
    // El orden es: angular -> línea vacía -> app -> línea vacía -> relative
    const sortedBlock: string[] = [];

    // Grupo 1: Angular y Terceros
    if (groups.angular.length > 0) {
        sortedBlock.push(...groups.angular);
    }

    // Grupo 2: Alias de la Aplicación (separado por una línea vacía)
    if (groups.app.length > 0) {
        if (sortedBlock.length > 0) {
            sortedBlock.push(''); // Salto de línea
        }
        sortedBlock.push(...groups.app);
    }

    // Grupo 3: Relativas (separado por una línea vacía)
    if (groups.relative.length > 0) {
        if (sortedBlock.length > 0) {
            sortedBlock.push(''); // Salto de línea
        }
        sortedBlock.push(...groups.relative);
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

    // ===================================================================
    // 3. Implementación del Algoritmo de Clasificación (El Corazón de la Lógica)
    // ===================================================================

    const { importLines, nonImportContent, importRange } = extractImports(document, fullText);

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
        sortAngularImports(); // Llamamos a nuestra nueva función de lógica
    });

    context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

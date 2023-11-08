const core = require('@actions/core');
const jsonlint = require('jsonlint');
const jsonMap = require('json-source-map');
const fs = require('fs');

// Glob needs posix
const path = require('node:path').posix;
const glob = require('glob');

let workspace;
if (process.env.CI)
    workspace = process.env['GITHUB_WORKSPACE'];
else
    workspace = './../Locale';

const mainLanguage = 'en.json';

function formatError(file, line, endLine, title, message) {
    return `::error file=${file},line=${line},endLine=${endLine},title=${title}::${message}`;
}

async function loadLocaleFile(file) {
    // There's some oddities between my local run and github. This may fix that I think.. Yay
    let filePath = file;
    if (!filePath.includes("Locale")) {
        filePath = path.join(workspace, file);
    }
    try {
        core.info(`Reading from ${filePath}`);
        const fileContents = await fs.promises.readFile(filePath, { encoding: 'utf-8' });
        let fileJson;
        try {
            fileJson = jsonlint.parse(fileContents);
        } catch (e) {
            // jsonlint errors include line number information
            return {success: false, json:null, error: formatError(filePath, e.line, e.line, 'Load Locale File', `Could not validate the ${file} language file. Reason: ${e}`)};
        }
        return {success: true, json:fileJson, error: null};
    } catch (e) {
        // Errors are returned rather than thrown here, so we can log them all, rather than bailing after one.
        return {success: false, json:null, error: formatError(filePath, 0, 0, 'Load Locale File', `Could not validate the ${file} language file. Reason: ${e}`)};
    }
}

async function validateLocale(localeJson, keys, fileContents) {
    const parsed = jsonMap.parse(fileContents);
    const invalidKeys = Object
        .keys(localeJson.messages)
        .filter(key => !keys.includes(key));

    if (invalidKeys.length > 0) {
        const errors = invalidKeys.map(key => {
            const position = parsed.pointers[`/messages/${key}`];
            const line = position ? position.value.line + 1 : 0;
            const column = position ? position.value.column + 1 : 0;
            return formatError(localeJson, line, column, 'Validate Locale', `Locale: ${localeJson.localeCode} has invalid key: ${key}`);
        });

        return {
            success: false,
            errors
        };
    }
    return {success:true, error: null};
}

async function main() {
    try {
        const errors = [];

        const mainLocaleResult = await loadLocaleFile(mainLanguage);
        if (!mainLocaleResult.success) {
            console.error(mainLocaleResult.error);
            core.setFailed("Unable to load and validate the main locale.");
            return;
        }

        const mainLocale = mainLocaleResult.json;

        const mainKeys = Object.keys(mainLocale.messages);

        const locales = glob.globSync(path.join(workspace,'*.json'));

        for (let locale of locales) {
            // Skip validating the main language again
            if (locale.endsWith(mainLanguage))
                continue;

            core.info(`Validating ${locale}`);

            const localeJsonResult = await loadLocaleFile(locale);
            if (!localeJsonResult.success) {
                errors.push(localeJsonResult.error);
                continue;
            }

            const fileContents = await fs.promises.readFile(filePath, { encoding: 'utf-8' });
            const localeJson = JSON.parse(fileContents);
            const result = await validateLocale(localeJson, mainKeys, fileContents);
            if (!result.success) {
                errors.push(result.error);
            }
        }
        if (errors.length == 0) {
            core.info('All locale files were validated successfully');
        } else {
            for(let error of errors) {
                console.error(error);
            }
            core.setFailed('Could not validate all locale files, see log for more information.');
        }
    } catch (e) {
        console.error(formatError('unknown', 0, 0, 'Main Function', e.message));
        core.setFailed(e.message);
    }
}

main();

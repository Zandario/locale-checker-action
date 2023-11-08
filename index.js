const core = require('@actions/core');
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

async function loadLocaleFile(file) {
    // There's some oddities between my local run and github. This may fix that I think.. Yay
    let filePath = file;
    if (!filePath.includes("Locale")) {
        filePath = path.join(workspace, file);
    }
    try {
        core.info(`Reading from ${filePath}`);
        const fileContents = await fs.promises.readFile(filePath, { encoding: 'utf-8' });
        const fileJson = JSON.parse(fileContents);
        return {success: true, json:fileJson, error: null};
    } catch (e) {
        // Errors are returned rather than thrown here, so we can log them all, rather than bailing after one.
        return {success: false, json:null, error: new Error(`Could not validate the ${file} language file. Reason: ${e}`)};
    }
}

async function validateLocale(locale, keys) {
    // Right now this just checks if there are keys, in a custom locale
    // That are NOT in the "main" locale.
    const invalidKeys = Object
        .keys(locale.messages)
        .filter(key => !keys.includes(key));

    if (invalidKeys.length > 0) {
        // Errors are returned rather than thrown here, so we can log them all, rather than bailing after one.

        return {
            success:false, 
            error: new Error(`Locale: ${locale.localeCode} has invalid keys: ${invalidKeys.join(',')}`)
        };
    }
    return {success:true, error: null};
}

async function main() {
    try {
        const errors = [];

        const mainLocaleResult = await loadLocaleFile(mainLanguage);
        if (!mainLocaleResult.success) {
            core.error(mainLocaleResult.error);
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

            const localeJson = localeJsonResult.json;

            const result = await validateLocale(localeJson, mainKeys);
            if (!result.success) {
                errors.push(result.error);
            }
        }
        if (errors.length == 0) {
            core.info('All locale files were validated successfully');
            core.set
        } else {
            for(let error of errors) {
                core.error(error.message);
            }
            core.setFailed('Could not validate all locale files, see log for more information.');
        }
    } catch (e) {
        core.setFailed(e.message);
    }
}

main();

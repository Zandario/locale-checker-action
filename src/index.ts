import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

let workspace: string;
if (process.env.CI)
    workspace = process.env['GITHUB_WORKSPACE'] || '';
else
    workspace = './../Locale';

const mainLanguage = 'en.json';

interface LocaleFileResult {
    success: boolean;
    json: any;
    error: Error | null;
}

async function loadLocaleFile(file: string): Promise<LocaleFileResult> {
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
        return {success: false, json:null, error: new Error(`Could not validate the ${file} language file. Reason: ${e}`)};
    }
}

interface ValidateLocaleResult {
    success: boolean;
    error: Error | null;
}

async function validateLocale(locale: any, keys: string[]): Promise<ValidateLocaleResult> {
    const invalidKeys = Object
        .keys(locale.messages)
        .filter(key => !keys.includes(key));

    if (invalidKeys.length > 0) {
        return {
            success:false,
            error: new Error(`Locale: ${locale.localeCode} has invalid keys: ${invalidKeys.join(',')}`)
        };
    }
    return {success:true, error: null};
}

async function main() {
    try {
        const errors: Error[] = [];

        const mainLocaleResult = await loadLocaleFile(mainLanguage);
        if (!mainLocaleResult.success) {
            core.error(mainLocaleResult.error!.message);
            core.setFailed("Unable to load and validate the main locale.");
            return;
        }

        const mainLocale = mainLocaleResult.json;

        const mainKeys = Object.keys(mainLocale.messages);

        const locales = glob.globSync(path.join(workspace,'*.json'));

        for (let locale of locales) {
            if (locale.endsWith(mainLanguage))
                continue;

            core.info(`Validating ${locale}`);

            const localeJsonResult = await loadLocaleFile(locale);
            if (!localeJsonResult.success) {
                errors.push(localeJsonResult.error!);
                continue;
            }

            const localeJson = localeJsonResult.json;

            const result = await validateLocale(localeJson, mainKeys);
            if (!result.success) {
                errors.push(result.error!);
            }
        }
        if (errors.length == 0) {
            core.info('All locale files were validated successfully');
        } else {
            for(let error of errors) {
                core.error(error.message);
            }
            core.setFailed('Could not validate all locale files, see log for more information.');
        }
    } catch (e: any) {
        core.setFailed(e.message);
    }
}

main();

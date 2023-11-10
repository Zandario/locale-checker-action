import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'node:path';
import * as glob from 'glob';
import { AnnotatedError, Locale } from './helper';

const workspace: string = process.env.CI ? process.env['GITHUB_WORKSPACE'] || '' : './../Locale';
const mainLanguage = 'en.json';


async function loadLocaleFile(file: string): Promise<{ success: boolean, json: Locale | null, error: AnnotatedError | null }> {
    let filePath = file;
    if (!filePath.includes("Locale")) {
        filePath = path.join(workspace, file);
    }
    try {
        core.debug(`Reading from ${filePath}`);
        const fileContents = await fs.promises.readFile(filePath, { encoding: 'utf-8' });
        const fileJson = JSON.parse(fileContents) as Locale;
        return { success: true, json: fileJson, error: null };
    } catch (e) {
        return { success: false, json: null, error: new AnnotatedError(`Could not validate the ${file} language file. Reason: ${e}`) };
    }
}

async function validateLocale(locale: Locale, keys: string[]): Promise<{ success: boolean, error: AnnotatedError | null }> {
    const invalidKeys = Object
        .keys(locale.messages)
        .filter((key: string) => !keys.includes(key));

    if (invalidKeys.length > 0) {
        return {
            success: false,
            error: new AnnotatedError(`Locale: ${locale.localeCode} has invalid keys: ${invalidKeys.join(',')}`)
        };
    }
    return { success: true, error: null };
}


async function main(): Promise<void> {
    try {

        core.info(`Parsing locale files in ${workspace}`);
        // Read the reference JSON file
        const referenceData = JSON.parse(fs.readFileSync('en.json', 'utf8'));

        // Get the keys from the reference JSON file
        const referenceKeys = Object.keys(referenceData);

        const errors: AnnotatedError[] = [];

        const mainLocaleResult = await loadLocaleFile(mainLanguage);
        if (!mainLocaleResult.success) {
            if (mainLocaleResult.error) {
                core.error(mainLocaleResult.error.message);
            }
            core.setFailed("Unable to load and validate the main locale.");
            return;
        }

        const mainLocale = mainLocaleResult.json;
        const mainKeys = Object.keys(mainLocale!.messages);
        const locales = glob.sync(path.join(workspace, '*.json')).filter(locales => locales !== 'mainLanguage');

        core.startGroup('Validating Locales')
        for (let locale of locales) {

            core.info(`Validating ${locale}`);

            const localeJsonResult = await loadLocaleFile(locale);
            if (!localeJsonResult.success) {
                if (localeJsonResult.error) {
                    errors.push(localeJsonResult.error);
                }
                continue;
            }

            const localeJson = localeJsonResult.json;

            const result = await validateLocale(localeJson!, mainKeys);
            if (!result.success) {
                if (result.error) {
                    errors.push(result.error);
                }
            }
        }

        if (errors.length == 0) {
            core.info('All locale files were validated successfully');
        } else {
            for (let error of errors) {
                core.error(error.message);
            }
            core.setFailed('Could not validate all locale files, see log for more information.');
        }
        core.endGroup()

    } catch (e) {
        if (e instanceof AnnotatedError) {
            core.setFailed(e.message);
        } else {
            core.setFailed('An unknown error occurred');
        }
    }
}

main();

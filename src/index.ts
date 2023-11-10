import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'node:path';
import * as glob from 'glob';
import * as helper from './helper';
import { AnnotationProperties } from '@actions/core';
import { AnnotatedError, Locale } from './helper';

declare var require: any;
const jsonSourceMap = require('json-source-map');


const workspace: string = process.env.CI ? process.env['GITHUB_WORKSPACE'] || '' : './../Locale';
const mainLanguage = 'en.json';


async function loadLocaleFile(filePath: string): Promise<{ success: boolean, json: Locale | null, errors: AnnotatedError[] | null }> {
    if (!filePath.includes("Locale")) {
        filePath = path.join(workspace, filePath);
    }
    try {
        core.info(`Reading from ${filePath}`);
        const fileContents = await fs.promises.readFile(filePath, { encoding: 'utf-8' });
        const parsed = jsonSourceMap.parse(fileContents);
        return { success: true, json: parsed.data as Locale, errors: null };
    } catch (e: any) {
        const line = e.mark ? e.mark.line : 0;
        const column = e.mark ? e.mark.column : 0;
        const annotationProperties: AnnotationProperties = {
            title: `Could not validate the ${filePath} language file. Reason: ${e}`,
            file: filePath,
            startLine: line + 1, // json-source-map uses 0-based line numbers, but GitHub uses 1-based line numbers
            startColumn: column + 1, // json-source-map uses 0-based column numbers, but GitHub uses 1-based column numbers
        };
        return { success: false, json: null, errors: [new AnnotatedError(`Could not validate the ${filePath} language file. Reason: ${e}`, annotationProperties)] };
    }
}

async function validateLocale(filePath: string, locale: Locale, keys: string[]): Promise<{ success: boolean, errors: AnnotatedError[] | null }> {
    const invalidKeys = Object
        .keys(locale.messages)
        .filter((key: string) => !keys.includes(key));

    if (invalidKeys.length > 0) {
        const fileContents = await fs.promises.readFile(filePath, { encoding: 'utf-8' });
        const parsed = jsonSourceMap.parse(fileContents);

        const errors: AnnotatedError[] = invalidKeys.map(key => {
            const pointer = `/messages/${key}`;
            const position = parsed.pointers[pointer];
            const annotationProperties: AnnotationProperties = {
                title: `Invalid key`,
                file: filePath,
                startLine: position.value.line + 1, // json-source-map uses 0-based line numbers, but GitHub uses 1-based line numbers
                startColumn: position.value.column + 1, // json-source-map uses 0-based column numbers, but GitHub uses 1-based column numbers
            };
            return new AnnotatedError(`${key} is not a valid entry, either remove it or add it to ${mainLanguage}`, annotationProperties);
        });

        return {
            success: false,
            errors: errors
        };
    }
    return { success: true, errors: null };
}



async function main(): Promise<void> {
    try {

        core.info(`Parsing locale files in ${workspace}`);
        // Read the reference JSON file
        const referenceData = JSON.parse(fs.readFileSync('en.json', 'utf8'));

        // Get the keys from the reference JSON file
        const referenceKeys = Object.keys(referenceData);

        const mainLocaleResult = await loadLocaleFile(mainLanguage);
        if (!mainLocaleResult.success) {
            if (mainLocaleResult.errors) {
                helper.printErrors(mainLocaleResult.errors);
            }
            core.setFailed("Unable to load and validate the main locale.");
            return;
        }

        const mainLocale = mainLocaleResult.json;
        const mainKeys = Object.keys(mainLocale!.messages);
        const locales = glob.sync(path.join(workspace, '*.json')).filter(locales => locales !== 'mainLanguage');

        for (let locale of locales) {

            core.startGroup(`Validating ${locale}`);

            const localeJsonResult = await loadLocaleFile(locale);
            const validationResult = await validateLocale(locale, localeJsonResult.json!, mainKeys);

            if (!localeJsonResult.success) {
                if (localeJsonResult.errors) {
                    helper.printErrors(localeJsonResult.errors);
                }
                continue;
            }

            if (!validationResult.success) {
                if (validationResult.errors) {
                    helper.printErrors(validationResult.errors);
                }
            }

        }


    } catch (e) {
        if (e instanceof Error) {
            core.setFailed(e.message);
        } else {
            core.setFailed('An unknown error occurred');
        }
    }
}

main();

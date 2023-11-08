import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { AnnotationProperties } from '@actions/core';

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
    annotation: AnnotationProperties | null;
}

async function AnnotationProperties(
    message: string,
    file: string,
    line: number,
    startColumn: number,
    endColumn: number): Promise<AnnotationProperties> {

    return {
        title: message || "Invalid locale file",
        file: file,
        startLine: line,
        endLine: line,
        startColumn: startColumn,
        endColumn: endColumn
    };
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
        return {success: true, json:fileJson, error: null, annotation: null};
    } catch (e) {
        const error: AnnotationProperties = {
            file: filePath,
            startLine: 0,
            endLine: 0,
            title: `Could not validate the ${file} language file. Reason: ${e}`
        };
        return {success: false, json:null, error:null, annotation: error};
    }
}

interface ValidateLocaleResult {
    success: boolean;
    error: Error | null;
    annotation: AnnotationProperties | null;
}

async function validateLocale(locale: any, keys: string[]): Promise<ValidateLocaleResult> {
    const invalidKeys = Object
        .keys(locale.messages)
        .filter(key => !keys.includes(key));

    if (invalidKeys.length > 0) {
        const error: AnnotationProperties = {
            file: locale.localeCode,
            startLine: 0,
            endLine: 0,
            title: `Locale: ${locale.localeCode} has invalid keys: ${invalidKeys.join(',')}`
        };
        return {success:false, error: null, annotation: error};
    }
    return {success:true, error: null, annotation: null};
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

        const locales = glob.globSync(path.join(workspace, '*.json'));

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
            for (let error of errors) {
                core.error(error.message);
            }
            core.setFailed('Could not validate all locale files, see log for more information.');
        }
    } catch (e: any) {
        core.setFailed(e.message);
    }
}

main();

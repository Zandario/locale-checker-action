import * as core from '@actions/core';
import { AnnotationProperties } from '@actions/core';
import * as fs from 'fs';
import * as path from 'node:path';
import * as glob from 'glob';

export interface Locale {
    localeCode: string;
    messages: Record<string, string>;
}

export class AnnotatedError {
    error: Error;
    annotationProperties?: AnnotationProperties;

    constructor(message: string | Error, annotationProperties?: AnnotationProperties) {
        if (message instanceof Error) {
            this.error = message;
        }
        else {
            this.error = new Error(message);
        }
        this.annotationProperties = annotationProperties;
    }

}



/**
 * Adds an error issue
 * @param message error issue message. Errors will be converted to string via toString()
 * @param properties optional properties to add to the annotation.
 */
export function error(annotatedError: AnnotatedError): void {

    if (annotatedError.annotationProperties) {
        core.error(annotatedError.error, annotatedError.annotationProperties);
    }
    else {
        core.error(annotatedError.error.message);
    }
}

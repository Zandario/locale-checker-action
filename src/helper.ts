import * as core from '@actions/core';
import { AnnotationProperties } from '@actions/core';
import * as fs from 'fs';
import * as path from 'node:path';
import * as glob from 'glob';

export interface Locale {
    localeCode: string;
    messages: Record<string, string>;
}

export class AnnotatedError extends Error {
    annotationProperties?: AnnotationProperties;

    constructor(message?: string, annotationProperties?: AnnotationProperties) {
        super(message); // Call the constructor of the Error class.
        this.name = 'AnnotatedError'; // Set the name property.
        this.annotationProperties = annotationProperties;

        // This line is needed to make the instanceof operator work correctly.
        Object.setPrototypeOf(this, AnnotatedError.prototype);
    }
}

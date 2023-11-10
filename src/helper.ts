import * as core from '@actions/core';
import { AnnotationProperties } from '@actions/core';
import * as fs from 'fs';
import * as path from 'node:path';
import * as glob from 'glob';

export interface Locale {
    localeCode: string;
    messages: Record<string, string>;
}

export interface AnnotationMessage {
    messageType: 'notice' |'error' | 'warning';
    AnnotationProperties: AnnotationProperties;
}

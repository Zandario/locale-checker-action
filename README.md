# Locale Checker Action

A very basic GitHub action that will run on our Locale repository to ensure that all locale files are valid. We have other tooling, but this means PRs will automatically be checked when people submit them, providing some basic assurances to our repo.

This is a work in progress. Thank you!

## Checks

This action carries out the following checks:
1. That the locale files are valid
2. That the locale files do not contain keys that are not contained within the main language file.

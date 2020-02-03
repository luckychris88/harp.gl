/*
 * Copyright (C) 2017-2019 HERE Europe B.V.
 * Licensed under Apache 2.0, see full license in LICENSE
 * SPDX-License-Identifier: Apache-2.0
 */

import { ThemeLoader } from "@here/harp-mapview";
import * as program from "commander";
import * as fs from "fs";
import * as glob from "glob";
import * as path from "path";

// tslint:disable: no-console

const version = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"))
    .version;

const _defaultInputPath: string = process.cwd();
const _defaultOutputPath: string = process.cwd() + "/resources";
const _defaultMinify: boolean = false;
const _defaultVerbose: boolean = false;

program
    .version(version)
    .description("CLI tool for building theme files.")
    .usage("[options]")
    .requiredOption("-i, --in [file]", "Input file(s). Can contain wildcards as well.")
    .option("-C, --chdir [path]", "Change dir to resolve relative paths.", _defaultInputPath)
    .option("-o, --out [path]", "Output dir", _defaultOutputPath)
    .option("-m, --minify", "Minify JSON", _defaultMinify)
    .option("-v, --verbose", "Verbose mode", _defaultVerbose)
    .parse(process.argv);

const cliOptions = program.opts();

process.chdir(cliOptions.chdir);

const inputFiles = glob.sync(cliOptions.in);

if (inputFiles.length === 0) {
    console.error("No input files found");
    program.outputHelp();
    process.exit(1);
}

inputFiles.forEach(file => {
    ThemeLoader.load(file, {
        resolveResourceURIs: false,
        resolveIncludeURIs: true
    }).then(theme => {
        theme.url = undefined;
        const filename = `${cliOptions.out}/${path.basename(file)}`;
        console.log(`Writing ${filename}`);
        const json = cliOptions.minify
            ? JSON.stringify(theme)
            : JSON.stringify(theme, undefined, 4);
        fs.writeFileSync(filename, json);
    });
});

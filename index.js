#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs-extra');
const getStdin = require('get-stdin');
const assert = require('assert');
const globby = require('globby');
const path = require('path');

let { argv } = require('yargs')
  .usage('Usage: $0 [options]')
  .example('$0 -i input.css -o output.css', 'Inverts input.css and saves it as output.css')
  .example('$0 < input.css > output.css', 'Inverts input.css and saves it as output.css')
  .example('$0 < input.css', 'Inverts input.css and writes to stdout')
  .example('cat input.css | $0 | less', 'Inverts input.css and displays in less')
  .example('$0 -i \'./**/*.css\'', 'Inverts all *.css files recursively and writes them to their respective files')
  .alias('i', 'input')
  .nargs('i', 1)
  .describe('i', 'Input file to read, file globs allowed (quotes recommended)')
  .string('i') // We parse this path ourselves (might have wildcards).
  .alias('o', 'output')
  .nargs('o', 1)
  .describe('o', 'Output file to write')
  .normalize('o') // Normalizes to a path.
  .alias('f', 'force')
  .boolean('f')
  .describe('f', 'Forcibly overwrite (or "fix") the source file')
  .alias('d', 'dry')
  .boolean('d')
  .describe('d', 'Perform a dry run, without writing')
  .help('h')
  .alias('h', 'help')
  // .default(argsDefault)

let colorDictionary = {};

async function collectColors(str) {
  const codeRegex = /(#(?:[0-9a-f]{2}){2,4}|(#[0-9a-f]{3})|(rgb|hsl)a?\((-?\d+%?[,\s]+){2,3}\s*[\d\.]+%?\))/igm;
  const nameRegex = /\b(black|silver|gray|whitesmoke|maroon|red|purple|fuchsia|green|lime|olivedrab|yellow|navy|blue|teal|aquamarine|orange|aliceblue|antiquewhite|aqua|azure|beige|bisque|blanchedalmond|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|gainsboro|ghostwhite|goldenrod|gold|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavenderblush|lavender|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|limegreen|linen|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|oldlace|olive|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|thistle|tomato|turquoise|violet|wheat|white|yellowgreen|rebeccapurple)\b/igm;

  let m = null;
  while ((m = codeRegex.exec(str)) !== null) {
      if (m.index === codeRegex.lastIndex) {
          codeRegex.lastIndex++;
      }
      
      m.forEach((match, groupIndex) => {
          console.log(`Found match, group ${groupIndex}: ${match}`);
      });
  }
  
  m = null;
  while ((m = nameRegex.exec(str)) !== null) {
      if (m.index === nameRegex.lastIndex) {
          nameRegex.lastIndex++;
      }
      
      m.forEach((match, groupIndex) => {
          console.log(`Found match, group ${groupIndex}: ${match}`);
      });
  }
}

// async function convertIncludesToClang(str) {
//   // eslint-disable-next-line no-useless-escape
//   const regex = /^\s*(include|use)\s*<([_\-\.\w\/]*)>;{0,1}\s*$/gm;
//
//   // {type: 'include' | 'use', path: 'cornucopia/../source.css'}
//   const backup = [];
//   let matches = regex.exec(str);
//   let updated = str;
//
//   while (matches !== null) {
//     if (matches.index === regex.lastIndex) {
//       regex.lastIndex += 1;
//     }
//
//     let entry = {};
//     // eslint-disable-next-line no-loop-func
//     matches.forEach((match, groupIndex) => {
//       if (groupIndex === 0) {
//         entry = {};
//         entry.full = match;
//       } else if (groupIndex === 1) {
//         entry.type = match;
//       } else if (groupIndex === 2) {
//         entry.path = match;
//         updated = updated.replace(entry.full.trim(), `#include <${entry.path}>`);
//         backup.push(entry);
//       }
//     });
//
//     matches = regex.exec(str);
//   }
//
//   return { result: updated, backup };
// }

// async function addDocumentation(str) {
//   return str;
// }

// async function convertIncludesTocss(str, backup) {
//   // eslint-disable-next-line no-useless-escape
//   const regex = /^\s*#include\s*<([_\-\.\w\/]*)>;{0,1}\s*$/gmi;
//   let fixed = str;
//   let matches = regex.exec(str);
//
//   while (matches !== null) {
//     if (matches.index === regex.lastIndex) {
//       regex.lastIndex += 1;
//     }
//
//     let entry = {};
//     // eslint-disable-next-line no-loop-func
//     matches.forEach((match, groupIndex) => {
//       if (groupIndex === 0) {
//         entry = { full: match };
//       } else if (groupIndex === 1) {
//         entry.path = match;
//
//         // Must traverse in order.
//         for (let i = 0; i < backup.length; i += 1) {
//           if (backup[i].path === entry.path) {
//             // Replace only _a single occurance_.
//             fixed = fixed.replace(new RegExp(entry.full.trim(), ''), `${backup[i].type} <${backup[i].path}>`, '');
//
//             // Splice out the one we just performed.
//             backup.splice(i, 1);
//             break;
//           }
//         }
//       }
//     });
//
//     matches = regex.exec(str);
//   }
//
//   return fixed;
// }

async function invert(str) {
  try {
    assert(str, 'Did not receive string to format');

    // eslint-disable-next-line prefer-const
    // let { result, backup } = await convertIncludesToClang(str);
    // assert(result, 'Failed to convert CSS includes to Clang includes');

    // if (argv.javadoc) {
    //   result = await addDocumentation(result);
    //   assert(result, 'Javadoc failed to format source');
    // }

    // const { path: tmpFilePath, cleanup: cleanupTmpFile } = await tmp.file({ dir: tmpDir.path, postfix: '.css' });

    // const virtualFile = {
    //   path: tmpFilePath,
    // };
    // await fs.writeFile(virtualFile.path, result);

    // result = await getClangFormattedString(virtualFile);
    // assert(result, 'Clang failed to format source');

    // result = await convertIncludesTocss(result, backup);
    // assert(result, 'Failed to convert Clang includes to CSS includes');

    // try {
    //   await fs.remove(virtualFile.path);
    // } catch (err) {
    //   console.error('Failed to remove temporary input file', err);
    // }

    // cleanupTmpFile();
    
    collectColors(str);
    let result = str;

    return result;
  } catch (err) {
    console.error('Failure while inverting colors', err);
    throw err;
  }
}

async function feed(input, output) {
  let str = null;

  if (input) {
    str = await fs.readFile(input);
  } else {
    str = await getStdin();
  }

  str = str.toString();

  if (!str) {
    // Do not write to output since we sometimes use stdout.
    // console.warn(`Contents of ${input} is empty; skipping ...`);
    return '';
  }

  try {
    const result = await invert(str);

    if (result) {
      if (!argv.dry && output && argv.input && argv.input.length > 1) {
        await fs.outputFile(path.join(argv.output, path.basename(input)), result);
      } else if (!argv.dry && output) {
        await fs.writeFile(output, result);
      } else if (!argv.dry && argv.force && input) {
        // Write it back to the source location.
        await fs.writeFile(input, result);
      } else if (argv.dry && argv.isCLI) {
        process.stdout.write(result);
      }
      return result;
    }

    throw new Error('Failed to invert content string');
  } catch (err) {
    console.error('Failed to feed to inverter and write output', err);
    throw err;
  }
}

async function main(params) {
  if (params) {
    argv = params;
  }

  if (argv.input) {
    try {
      argv.input = await globby(argv.input, {
        deep: true,
        gitignore: true,
      });
    } catch (err) {
      console.error(`Failed to glob input using ${argv.input}`, err);
    }
  }

  try {
    if (argv.output && argv.input && argv.input.length > 1) {
      await fs.ensureDir(argv.output);
    } else if (argv.output && argv.input && argv.input.length === 1) {
      await fs.ensureFile(argv.output);
    }
  } catch (err) {
    console.error('Failure while ensuring proper output pathing', err);
  }

  const resultList = [];

  try {
    if (argv.input) {
      await Promise.all(argv.input.map(async (file) => {
        try {
          const result = await feed(file, argv.output, tmpDir);
          resultList.push({ source: file, formatted: result });
        } catch (err) {
          console.error('Failed to feed input files', err);
        }
      }));
    } else {
      // Use stdin.
      try {
        const result = await feed(null, argv.output, tmpDir);
        resultList.push({ source: 'stdin', formatted: result });
      } catch (err) {
        console.error('Failed to feed stdin', err);
      }
    }

    return resultList;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

if (require.main === module) {
  // Called via CLI.
  argv.isCLI = true;
  if (!argv.help) {
    main();
  }
} else {
  // Called via require.
  argv.isCLI = false;
  module.exports = main;
}

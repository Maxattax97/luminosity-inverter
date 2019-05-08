#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs-extra');
const getStdin = require('get-stdin');
const assert = require('assert');
const globby = require('globby');
const path = require('path');
const culori = require('culori');

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
  .alias('h', 'help');
  // .default(argsDefault)

String.prototype.replaceAll = function (str1, str2, ignore) {
  return this.replace(new RegExp(str1.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g, '\\$&'), (ignore ? 'gi' : 'g')), (typeof (str2) === 'string') ? str2.replace(/\$/g, '$$$$') : str2);
};

const colorDictionary = {};

function collectColors(str) {
  const codeRegex = /(#(?:[0-9a-f]{2}){2,4}|(#[0-9a-f]{3})|(rgb|hsl)a?\((-?\d+%?[,\s]+){2,3}\s*[\d\.]+%?\))/igm;
  const nameRegex = /\b(black|silver|gray|whitesmoke|maroon|red|purple|fuchsia|green|lime|olivedrab|yellow|navy|blue|teal|aquamarine|orange|aliceblue|antiquewhite|aqua|azure|beige|bisque|blanchedalmond|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|gainsboro|ghostwhite|goldenrod|gold|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavenderblush|lavender|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|limegreen|linen|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|oldlace|olive|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|thistle|tomato|turquoise|violet|wheat|white|yellowgreen|rebeccapurple)\b/igm;

  let m = null;
  while ((m = codeRegex.exec(str)) !== null) {
    if (m.index === codeRegex.lastIndex) {
      codeRegex.lastIndex++;
    }

    colorDictionary[m[0]] = null;
    // m.forEach((match, groupIndex) => {
    //     console.log(`Found match, group ${groupIndex}: ${match}`);
    // });
  }

  m = null;
  while ((m = nameRegex.exec(str)) !== null) {
    if (m.index === nameRegex.lastIndex) {
      nameRegex.lastIndex++;
    }

    colorDictionary[m[0]] = null;
    // m.forEach((match, groupIndex) => {
    //     console.log(`Found match, group ${groupIndex}: ${match}`);
    // });
  }

  // console.log(colorDictionary);
}

function invertLuminosity(colorStr) {
  const obj = culori.parse(colorStr);
  const inverted = culori.converter('lab')(obj);
  inverted.l = Math.abs(100 - inverted.l);
  let orgMode = null;

  if (colorStr.indexOf('#') !== -1) {
    obj.mode = 'hex';
  }

  switch (obj.mode) {
    case 'rgb':
    case 'hsl':
      orgMode = culori.formatter('rgb')(culori.clamp('rgb')(inverted));
      break;
    default:
      orgMode = culori.formatter('hex')(culori.clamp('rgb')(inverted));
  }

  // console.log(`${colorStr} -> ${inverted.l}, ${inverted.a}, ${inverted.b} -> ${orgMode}`);
  return orgMode;
}

function transformDictionary() {
  Object.keys(colorDictionary).forEach((key) => {
    if (!colorDictionary[key]) {
      colorDictionary[key] = invertLuminosity(key);
    }
  });
}

function translateColors(str) {
  Object.keys(colorDictionary).forEach((key) => {
    // str = str.split(key).join(colorDictionary[key]);
    str = str.replaceAll(key, colorDictionary[key]);
  });

  return str;
}

async function invert(str) {
  try {
    assert(str, 'Did not receive string to format');

    collectColors(str);
    transformDictionary();
    const result = translateColors(str);

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
          const result = await feed(file, argv.output);
          resultList.push({ source: file, formatted: result });
        } catch (err) {
          console.error('Failed to feed input files', err);
        }
      }));
    } else {
      // Use stdin.
      try {
        const result = await feed(null, argv.output);
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

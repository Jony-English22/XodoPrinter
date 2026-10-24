'use strict';

/**
 * Clase 13: crea un runtime Java PRIVADO para Windows x64 a partir de un JDK instalado.
 * Nunca descarga runtimes ni instala/modifica Java en el sistema del usuario.
 * Ejecutar DESPUES de stage.cjs, que prepara .staged/web y .staged/backend.
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const ROOT_MODULES = Object.freeze([
  'java.se',
  'jdk.unsupported',
  'jdk.crypto.ec',
  'jdk.charsets',
  'jdk.localedata',
  'jdk.management',
  'jdk.zipfs',
]);

function isJdkHome(directory) {
  return typeof directory === 'string' && directory.length > 0 &&
    fs.existsSync(path.join(directory, 'bin', 'java.exe')) &&
    fs.existsSync(path.join(directory, 'bin', 'jlink.exe')) &&
    fs.existsSync(path.join(directory, 'jmods', 'java.base.jmod'));
}

function resolveJdkHome(env = process.env) {
  const candidates = [];
  if (env.JAVA_HOME) candidates.push(env.JAVA_HOME.replace(/^"|"$/g, ''));
  try {
    const found = execFileSync('where.exe', ['jlink.exe'], { encoding: 'utf8', windowsHide: true });
    for (const file of found.split(/\r?\n/)) {
      if (file.trim()) candidates.push(path.resolve(file.trim(), '..', '..'));
    }
  } catch { /* JAVA_HOME puede bastar. */ }
  for (const candidate of candidates) {
    if (isJdkHome(candidate)) return path.resolve(candidate);
  }
  throw new Error('No se encontro un JDK de Windows con jmods y jlink.exe. Configura JAVA_HOME al directorio del JDK 25.');
}

function makeJlinkArgs(jdkHome, outputDirectory) {
  return [
    '--module-path', path.join(jdkHome, 'jmods'),
    '--add-modules', ROOT_MODULES.join(','),
    '--strip-debug', '--no-header-files', '--no-man-pages',
    '--compress=zip-6',
    '--output', outputDirectory,
  ];
}

function readJavaMajor(javaExecutable) {
  const result = spawnSync(javaExecutable, ['-version'], {
    encoding: 'utf8', windowsHide: true, timeout: 10000,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`No se pudo ejecutar ${javaExecutable}: ${result.error?.message || result.stderr || result.status}`);
  }
  const versionText = `${result.stderr || ''}\n${result.stdout || ''}`;
  const match = versionText.match(/version\s+"(\d+)/);
  if (!match) throw new Error(`No se pudo identificar la version de Java: ${versionText}`);
  return Number(match[1]);
}

function buildPrivateRuntime(desktopDirectory = path.resolve(__dirname, '..'), options = {}) {
  const platform = options.platform || process.platform;
  const arch = options.arch || process.arch;
  if (platform !== 'win32' || arch !== 'x64') {
    throw new Error('Para crear el runtime Windows x64 ejecuta este paso desde Windows 11 x64 con un JDK de Windows.');
  }
  const jdkHome = options.jdkHome || resolveJdkHome();
  if (!isJdkHome(jdkHome)) throw new Error(`La carpeta no contiene un JDK de Windows valido: ${jdkHome}`);
  const major = readJavaMajor(path.join(jdkHome, 'bin', 'java.exe'));
  if (major < 21) throw new Error(`Este proyecto requiere Java 21 o superior; se detecto Java ${major}. Recomendado: JDK 25.`);

  const staged = path.join(desktopDirectory, '.staged');
  if (!fs.existsSync(path.join(staged, 'web', 'index.html')) ||
      !fs.existsSync(path.join(staged, 'backend', 'xodoprinter.jar'))) {
    throw new Error('Primero ejecuta node scripts/stage.cjs para copiar Angular y el JAR.');
  }

  const output = path.join(staged, 'runtime');
  fs.rmSync(output, { recursive: true, force: true });
  const jlinkExecutable = path.join(jdkHome, 'bin', 'jlink.exe');
  const args = makeJlinkArgs(jdkHome, output);
  console.log(`[runtime] JDK de origen: ${jdkHome} (Java ${major})`);
  console.log(`[runtime] Modulos: ${ROOT_MODULES.join(', ')}`);
  const result = spawnSync(jlinkExecutable, args, { stdio: 'inherit', windowsHide: true });
  if (result.error || result.status !== 0) {
    fs.rmSync(output, { recursive: true, force: true });
    throw new Error(`jlink no pudo construir el runtime: ${result.error?.message || `codigo ${result.status}`}`);
  }
  const privateJava = path.join(output, 'bin', 'java.exe');
  if (!fs.existsSync(privateJava)) throw new Error('jlink termino pero no existe runtime/bin/java.exe');
  const privateMajor = readJavaMajor(privateJava);
  if (privateMajor !== major) throw new Error('El runtime construido no coincide con la version del JDK de origen.');
  console.log(`[runtime] Listo: ${privateJava}`);
  return { jdkHome, output, javaExecutable: privateJava, javaMajor: privateMajor };
}

if (require.main === module) {
  try { buildPrivateRuntime(); }
  catch (error) {
    console.error('[runtime] ERROR:', error.message);
    process.exitCode = 1;
  }
}

module.exports = { ROOT_MODULES, isJdkHome, resolveJdkHome, makeJlinkArgs, readJavaMajor, buildPrivateRuntime };

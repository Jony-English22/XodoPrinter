'use strict';

const fs = require('node:fs');
const path = require('node:path');

function findAngularOutput(repoRoot) {
  const dist = path.join(repoRoot, 'frontend', 'dist');
  if (!fs.existsSync(dist)) throw new Error(`Angular no esta compilado: ${dist}. Ejecuta pnpm build.`);
  const candidates = [];
  for (const entry of fs.readdirSync(dist, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const suffix of ['browser', '.']) {
      const candidate = path.resolve(dist, entry.name, suffix);
      if (fs.existsSync(path.join(candidate, 'index.html'))) candidates.push(candidate);
    }
  }
  if (candidates.length !== 1) {
    throw new Error(`Se esperaba una sola salida Angular (index.html); encontradas: ${candidates.join(', ') || 'ninguna'}`);
  }
  return candidates[0];
}

function findSpringBootJar(repoRoot) {
  const choices = [];
  for (const folder of [path.join(repoRoot, 'target'), path.join(repoRoot, 'backend', 'target')]) {
    if (!fs.existsSync(folder)) continue;
    for (const name of fs.readdirSync(folder)) {
      if (!name.endsWith('.jar') || /(-sources|-javadoc|-plain)\.jar$/i.test(name)) continue;
      choices.push(path.join(folder, name));
    }
  }
  if (choices.length !== 1) {
    throw new Error(`Se esperaba un JAR ejecutable Spring Boot; encontrados: ${choices.join(', ') || 'ninguno'}.`);
  }
  const header = fs.readFileSync(choices[0]).subarray(0, 4).toString('hex');
  if (header !== '504b0304') throw new Error(`El archivo no parece un JAR valido: ${choices[0]}`);
  return choices[0];
}

function stageBuild(repoRoot, desktopRoot) {
  const angular = findAngularOutput(repoRoot);
  const jar = findSpringBootJar(repoRoot);
  const dest = path.join(desktopRoot, '.staged');
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(path.join(dest, 'backend'), { recursive: true });
  fs.cpSync(angular, path.join(dest, 'web'), { recursive: true, dereference: true });
  fs.copyFileSync(jar, path.join(dest, 'backend', 'xodoprinter.jar'));
  return {
    angular,
    jar,
    web: path.join(dest, 'web'),
    backendJar: path.join(dest, 'backend', 'xodoprinter.jar'),
  };
}

if (require.main === module) {
  try {
    const desktopRoot = path.resolve(__dirname, '..');
    const repoRoot = path.resolve(desktopRoot, '..');
    const result = stageBuild(repoRoot, desktopRoot);
    console.log('[stage] Angular:', result.angular);
    console.log('[stage] Spring Boot:', result.jar);
    console.log('[stage] Copias privadas en desktop/.staged (no se altera backend ni frontend).');
  } catch (err) {
    console.error('[stage] ERROR:', err.message);
    process.exitCode = 1;
  }
}

module.exports = { findAngularOutput, findSpringBootJar, stageBuild };
